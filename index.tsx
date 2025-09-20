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
const contextRadios = document.querySelectorAll('input[name="context"]') as NodeListOf<HTMLInputElement>;
const textInputContainer = document.getElementById('text-input-container') as HTMLDivElement;
const promptInput = document.getElementById('prompt-input') as HTMLInputElement;


// --- State Management ---
let selectedFile: File | null = null;
let selectedContext: 'clothes' | 'celebrity' | 'background' = 'clothes';


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
  const isTextInputRequired = selectedContext === 'celebrity' || selectedContext === 'background';
  const isTextInputFilled = promptInput.value.trim() !== '';

  if (!selectedFile) {
    applyButton.disabled = true;
    return;
  }
  
  if (isTextInputRequired && !isTextInputFilled) {
    applyButton.disabled = true;
  } else {
    applyButton.disabled = false;
  }
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

contextRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    selectedContext = radio.value as 'clothes' | 'celebrity' | 'background';

    if (selectedContext === 'celebrity' || selectedContext === 'background') {
      textInputContainer.style.display = 'block';
      promptInput.placeholder = selectedContext === 'celebrity' 
        ? 'Enter celebrity name...' 
        : 'Describe the background...';
      promptInput.value = ''; // Clear previous input
    } else {
      textInputContainer.style.display = 'none';
    }
    updateButtonState();
  });
});

promptInput.addEventListener('input', updateButtonState);


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
    
    // Construct the prompt dynamically
    let promptText = '';
    const inputValue = promptInput.value.trim();

    switch (selectedContext) {
      case 'clothes':
        promptText = 'Put a Pakistan army uniform on the person in this image, treating the uniform as clothing for a catalog or display. Ensure the result is a high-quality, realistic photo.';
        break;
      case 'celebrity':
        promptText = `Put a Pakistan army uniform on the person in this image, and change their face to look like ${inputValue}. Ensure the result is a high-quality, realistic photo as if for a photoshoot.`;
        break;
      case 'background':
        promptText = `Put a Pakistan army uniform on the person in this image, and change the background to: ${inputValue}. Ensure the person and uniform remain realistic and well-integrated.`;
        break;
    }

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
  
          const canvas = document.getElementById('watermark-canvas') as HTMLCanvasElement;
          const ctx = canvas.getContext('2d');
  
          if (ctx) {
              const img = new Image();
              img.onload = () => {
                  // Set canvas size to image size
                  canvas.width = img.width;
                  canvas.height = img.height;
  
                  // 1. Draw the original edited image
                  ctx.drawImage(img, 0, 0);
  
                  // 2. Draw BOLD diagonal lines
                  ctx.strokeStyle = 'rgba(80, 80, 80, 0.6)';
                  ctx.lineWidth = 4;
                  const step = 40;
                  for (let i = -canvas.height; i < canvas.width; i += step) {
                      ctx.beginPath();
                      ctx.moveTo(i, 0);
                      ctx.lineTo(i + canvas.height, canvas.height);
                      ctx.stroke();
                  }
  
                  // 3. Draw a more realistic "PAIDZ" stamp
                  const centerX = canvas.width / 2;
                  const centerY = canvas.height / 2;
                  const radius = Math.min(canvas.width, canvas.height) / 4;
  
                  // Save context for rotation
                  ctx.save();
                  ctx.translate(centerX, centerY);
                  ctx.rotate(-Math.PI / 12); // Rotate by -15 degrees
  
                  // Stamp styles
                  const stampColor = 'rgba(211, 47, 47, 0.75)'; // A strong, slightly transparent red
                  ctx.strokeStyle = stampColor;
                  ctx.fillStyle = stampColor;
                  ctx.lineWidth = radius / 12; // Proportional border width
  
                  // Draw the stamp circle border
                  ctx.beginPath();
                  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
                  ctx.stroke();
  
                  // Draw the "PAIDZ" text
                  ctx.font = `bold ${radius / 1.5}px 'Impact', 'Arial Black', sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText('PAIDZ', 0, 0);
                  
                  // Restore context to remove rotation
                  ctx.restore();
  
                  // 4. Update the visible image element and download button
                  const finalImageDataUrl = canvas.toDataURL(mimeType);
                  editedImage.src = finalImageDataUrl;
                  editedImage.style.display = 'block';
                  editedPlaceholder.style.display = 'none';
  
                  downloadButton.href = finalImageDataUrl;
                  downloadButton.style.display = 'inline-block';
              };
              img.src = `data:${mimeType};base64,${editedBase64}`;
          } else {
              // Fallback for if canvas fails - display original without watermark
              editedImage.src = `data:${mimeType};base64,${editedBase64}`;
              editedImage.style.display = 'block';
              editedPlaceholder.style.display = 'none';
          }
  
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