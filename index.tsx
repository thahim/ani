/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from '@google/genai';

// --- DOM Element Selection ---
const fileInput = document.getElementById('file-upload') as HTMLInputElement;
const originalImage = document.getElementById('original-image') as HTMLImageElement;
const editedImage = document.getElementById('edited-image') as HTMLImageElement;
const originalPlaceholder = document.getElementById('original-placeholder') as HTMLParagraphElement;
const editedPlaceholder = document.getElementById('edited-placeholder') as HTMLParagraphElement;
const applyButton = document.getElementById('apply-button') as HTMLButtonElement;
const downloadButton = document.getElementById('download-button') as HTMLAnchorElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;


// --- State Management ---
let selectedFile: File | null = null;


// --- Helper Functions ---
/**
 * Converts a File object to a base64 encoded string.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Checks conditions and updates the disabled state of the apply button.
 */
function updateButtonState() {
  applyButton.disabled = !selectedFile;
}

/**
 * Updates the UI to show/hide elements.
 * @param isLoading - Whether the app is in a loading state.
 * @param error - An optional error message to display.
 */
function updateUI(isLoading: boolean, error?: string) {
  loader.style.display = isLoading ? 'block' : 'none';
  
  if (isLoading) {
    applyButton.disabled = true;
  } else {
    updateButtonState();
  }
  
  if (error) {
    errorMessage.textContent = `Error: ${error}`;
    errorMessage.style.display = 'block';
  } else {
    errorMessage.style.display = 'none';
  }
}

// --- Event Listeners ---
fileInput.addEventListener('change', (event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    selectedFile = files[0];
    
    // Display the selected image
    const reader = new FileReader();
    reader.onload = (e) => {
      originalImage.src = e.target?.result as string;
      originalImage.style.display = 'block';
      originalPlaceholder.style.display = 'none';
    };
    reader.readAsDataURL(selectedFile);

    // Reset edited image view
    editedImage.src = '#';
    editedImage.style.display = 'none';
    editedPlaceholder.style.display = 'block';
    downloadButton.style.display = 'none';

    errorMessage.style.display = 'none';
    updateButtonState();
  }
});


applyButton.addEventListener('click', async () => {
  if (!selectedFile) {
    updateUI(false, "Please select an image first.");
    return;
  }

  updateUI(true);
  downloadButton.style.display = 'none';
  // Reset previous result
  editedImage.src = '#';
  editedImage.style.display = 'none';
  editedPlaceholder.style.display = 'block';

  try {
    const base64Image = await fileToBase64(selectedFile);
    
    // Get selected destination
    const selectedDestination = (document.querySelector('input[name="destination"]:checked') as HTMLInputElement)?.value || 'Kaaba';

    // Dynamically create prompt
    const promptText = `Take the person in the image and place them in front of the ${selectedDestination} in Saudi Arabia. The person should be wearing Ihram (ehram).`;

    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: selectedFile.type,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    let imageFound = false;

    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          const editedBase64 = part.inlineData.data;
          const mimeType = part.inlineData.mimeType;
          
          const finalImageDataUrl = `data:${mimeType};base64,${editedBase64}`;

          // Display the edited image directly
          editedImage.src = finalImageDataUrl;
          editedImage.style.display = 'block';
          editedPlaceholder.style.display = 'none';

          // Set up the download button
          downloadButton.href = finalImageDataUrl;
          downloadButton.style.display = 'inline-block';
  
          imageFound = true;
          break; 
        }
      }
    }
    
    if (!imageFound) {
      throw new Error("The AI did not return an image. The request may have been blocked or the model could not fulfill it. Please try a different image.");
    }

  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    updateUI(false, message);
  } finally {
    updateUI(false);
  }
});