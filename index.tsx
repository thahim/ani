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
 * Updates the UI to show/hide elements.
 * @param isLoading - Whether the app is in a loading state.
 * @param error - An optional error message to display.
 */
function updateUI(isLoading: boolean, error?: string) {
  loader.style.display = isLoading ? 'block' : 'none';
  applyButton.disabled = isLoading || !selectedFile;
  
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

    applyButton.disabled = false;
    errorMessage.style.display = 'none';
  }
});

applyButton.addEventListener('click', async () => {
  if (!selectedFile) {
    updateUI(false, "Please select an image first.");
    return;
  }

  updateUI(true);

  try {
    const base64Image = await fileToBase64(selectedFile);
    
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
            text: 'Put a Pakistan army uniform on the person in this image. Ensure the result is a high-quality, realistic photo.',
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    let imageFound = false;
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const editedBase64 = part.inlineData.data;
        editedImage.src = `data:${part.inlineData.mimeType};base64,${editedBase64}`;
        editedImage.style.display = 'block';
        editedPlaceholder.style.display = 'none';
        imageFound = true;
        break; 
      }
    }
    if (!imageFound) {
      throw new Error("The AI did not return an image. It might have been unable to process the request. Please try a different image.");
    }

  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    updateUI(false, message);
  } finally {
    updateUI(false);
  }
});
