/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

// --- DOM Elements ---
const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const uploadPlaceholder = document.getElementById('upload-placeholder') as HTMLDivElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const animateBtn = document.getElementById('animate-btn') as HTMLButtonElement;
const resultContainer = document.getElementById('result-container') as HTMLDivElement;
const resultVideo = document.getElementById('result-video') as HTMLVideoElement;
const downloadBtn = document.getElementById('download-btn') as HTMLAnchorElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const loaderMessage = document.getElementById('loader-message') as HTMLParagraphElement;

// --- State ---
let imageFile: File | null = null;
let imageBase64: string | null = null;

// --- Gemini AI Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Loading Messages ---
const loadingMessages = [
  "Warming up the animation engine...",
  "Teaching the pixels to dance...",
  "Composing a visual symphony...",
  "Rendering your masterpiece...",
  "Adding a touch of magic...",
  "Almost there, just polishing the frames...",
];
let messageInterval: number;

// --- Functions ---

/**
 * Converts a File object to a base64 encoded string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Result is `data:mime/type;base64,the-base-64-string`
      // We need to strip the prefix
      const encoded = reader.result as string;
      resolve(encoded.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Updates the UI and state when an image is selected.
 */
async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    imageFile = file;

    // Show preview
    imagePreview.src = URL.createObjectURL(file);
    imagePreview.classList.remove('hidden');
    uploadPlaceholder.classList.add('hidden');

    // Convert to base64 for the API
    try {
      imageBase64 = await fileToBase64(file);
    } catch (error) {
      console.error("Error converting file to base64:", error);
      alert("There was an error processing your image. Please try again.");
      resetUploader();
      return;
    }
    
    updateAnimateButtonState();
  }
}

/**
 * Resets the image uploader to its initial state.
 */
function resetUploader() {
  imageUpload.value = '';
  imageFile = null;
  imageBase64 = null;
  imagePreview.src = '#';
  imagePreview.classList.add('hidden');
  uploadPlaceholder.classList.remove('hidden');
  updateAnimateButtonState();
}

/**
 * Enables or disables the animate button based on whether an image and prompt are present.
 */
function updateAnimateButtonState() {
  const hasImage = !!imageFile;
  const hasPrompt = promptInput.value.trim().length > 0;
  animateBtn.disabled = !(hasImage && hasPrompt);
}

/**
 * Shows the loader with cycling messages.
 */
function showLoader() {
  let messageIndex = 0;
  loaderMessage.textContent = loadingMessages[messageIndex];
  loader.classList.remove('hidden');

  messageInterval = window.setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length;
    loaderMessage.textContent = loadingMessages[messageIndex];
  }, 4000);
}

/**
 * Hides the loader and stops the message cycling.
 */
function hideLoader() {
  loader.classList.add('hidden');
  clearInterval(messageInterval);
}

/**
 * Main function to call the Gemini API and handle the video generation process.
 */
async function animateImage() {
  if (!imageBase64 || !imageFile || !promptInput.value.trim()) {
    alert("Please upload an image and provide an animation prompt.");
    return;
  }

  showLoader();
  resultContainer.classList.add('hidden');

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-2.0-generate-001',
      prompt: promptInput.value.trim(),
      image: {
        imageBytes: imageBase64,
        mimeType: imageFile.type,
      },
      config: {
        numberOfVideos: 1,
      },
    });

    // Poll for the result
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!downloadLink) {
        throw new Error("Video generation failed or returned no URI.");
    }
    
    // The response.body contains the MP4 bytes. You must append an API key when fetching from the download link.
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
    }
    
    const videoBlob = await response.blob();
    const videoUrl = URL.createObjectURL(videoBlob);

    // Display the result
    resultVideo.src = videoUrl;
    downloadBtn.href = videoUrl;
    resultContainer.classList.remove('hidden');

  } catch (error) {
    console.error("Animation failed:", error);
    alert(`An error occurred during animation: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    hideLoader();
  }
}

// --- Event Listeners ---
imageUpload.addEventListener('change', handleImageUpload);
promptInput.addEventListener('input', updateAnimateButtonState);
animateBtn.addEventListener('click', animateImage);

// Drag and Drop functionality
const uploadLabel = imageUpload.parentElement as HTMLLabelElement;

if (uploadLabel) {
  uploadLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadLabel.classList.add('dragging');
  });

  uploadLabel.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadLabel.classList.remove('dragging');
  });

  uploadLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadLabel.classList.remove('dragging');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      imageUpload.files = files;
      // Manually trigger the change event
      const changeEvent = new Event('change');
      imageUpload.dispatchEvent(changeEvent);
    }
  });
}

export {};
