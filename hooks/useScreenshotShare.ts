import { useCallback } from 'react';
import html2canvas from 'html2canvas';
import {
  showSuccessToast,
  showErrorToast,
  showLoadingToast,
} from '../services/toastService';

interface ShareData {
  text: string;
  groupName: string;
  teamAName: string;
  teamBName: string;
}

export const useScreenshotShare = () => {
  const takeScreenshot = useCallback(
    async (element: HTMLElement): Promise<string | null> => {
      try {
        console.log('Taking screenshot of element:', element);
        console.log('Element ID:', element.id);
        console.log('Element classes:', element.className);

        // Ensure element is visible and rendered
        if (!element.offsetWidth || !element.offsetHeight) {
          console.error(
            'Element has no dimensions:',
            element.offsetWidth,
            element.offsetHeight
          );
          throw new Error('Element has no dimensions');
        }

        // Ensure the element is in the viewport
        element.scrollIntoView({ behavior: 'instant', block: 'center' });

        // Wait longer for content to load and render
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log('Element dimensions before screenshot:', {
          offsetWidth: element.offsetWidth,
          offsetHeight: element.offsetHeight,
          scrollWidth: element.scrollWidth,
          scrollHeight: element.scrollHeight,
        });

        const canvas = await html2canvas(element, {
          scale: 1, // Reducir escala para evitar problemas
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: true,
          height: element.offsetHeight,
          width: element.offsetWidth,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            console.log('Cloning document for screenshot');

            // Buscar el elemento específico en el documento clonado
            const clonedElement = clonedDoc.getElementById(element.id);
            console.log('Found cloned element:', clonedElement);

            if (clonedElement) {
              // Asegurar visibilidad y responsive design
              clonedElement.style.display = 'block';
              clonedElement.style.visibility = 'visible';
              clonedElement.style.opacity = '1';
              clonedElement.style.position = 'static';
              clonedElement.style.transform = 'none';
              clonedElement.style.width = '100%';
              clonedElement.style.maxWidth = '100%';
              clonedElement.style.overflow = 'visible';

              // Mejorar tipografía para screenshots
              const headings = clonedElement.querySelectorAll('h3');
              headings.forEach((heading) => {
                const h = heading as HTMLElement;
                h.style.fontSize = window.innerWidth < 768 ? '16px' : '18px';
                h.style.fontWeight = 'bold';
                h.style.lineHeight = '1.2';
                h.style.marginBottom = '4px';
              });

              // Mejorar visibilidad del texto de edad promedio
              const ageTexts = clonedElement.querySelectorAll('.text-gray-600');
              ageTexts.forEach((text) => {
                const t = text as HTMLElement;
                t.style.fontSize = window.innerWidth < 768 ? '13px' : '14px';
                t.style.fontWeight = '500';
                t.style.color = '#4b5563';
              });

              // Mejorar ratings
              const ratings = clonedElement.querySelectorAll('.bg-yellow-50');
              ratings.forEach((rating) => {
                const r = rating as HTMLElement;
                r.style.fontSize = window.innerWidth < 768 ? '13px' : '14px';
                r.style.padding =
                  window.innerWidth < 768 ? '3px 6px' : '4px 8px';
              });

              // Arreglar avatares
              const avatars = clonedElement.querySelectorAll('.MuiAvatar-root');
              console.log('Found avatars:', avatars.length);
              avatars.forEach((avatar) => {
                const avatarElement = avatar as HTMLElement;
                avatarElement.style.display = 'flex';
                avatarElement.style.alignItems = 'center';
                avatarElement.style.justifyContent = 'center';
                avatarElement.style.backgroundColor = '#f3f4f6';
                avatarElement.style.color = '#6b7280';
                avatarElement.style.width = '40px';
                avatarElement.style.height = '40px';
                avatarElement.style.borderRadius = '50%';
                avatarElement.style.border = '1px solid #e5e7eb';
              });

              // Agregar clase para ocultar botones de admin via CSS
              clonedElement.classList.add('screenshot-mode');
            }
          },
        });

        if (!canvas) {
          throw new Error('Failed to generate canvas');
        }

        console.log('Canvas generated successfully:', {
          width: canvas.width,
          height: canvas.height,
        });

        // Verificar que el canvas no esté vacío
        const ctx = canvas.getContext('2d');
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        const isEmpty = imageData?.data.every((pixel, index) => {
          // Verificar si todos los píxeles son transparentes o blancos
          if (index % 4 === 3) {
            // Canal alpha
            return pixel === 0 || pixel === 255;
          }
          return pixel === 255 || pixel === 0;
        });

        if (isEmpty) {
          console.error('Canvas appears to be empty');
          throw new Error('Screenshot appears to be empty');
        }

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        console.log('Screenshot generated, data URL length:', dataUrl.length);

        return dataUrl;
      } catch (error) {
        console.error('Error taking screenshot:', error);
        throw error;
      }
    },
    []
  );

  const copyToClipboard = useCallback(
    async (dataUrl: string): Promise<void> => {
      try {
        if (!navigator.clipboard) {
          throw new Error('Clipboard API not available');
        }

        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        // Create clipboard item
        const clipboardItem = new ClipboardItem({
          [blob.type]: blob,
        });

        // Copy to clipboard
        await navigator.clipboard.write([clipboardItem]);
        console.log('Image copied to clipboard');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        throw error;
      }
    },
    []
  );

  const shareViaWebShare = useCallback(
    async (dataUrl: string, shareData: ShareData): Promise<void> => {
      try {
        if (!navigator.share) {
          throw new Error('Web Share API not supported');
        }

        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        // Create a file from the blob
        const file = new File([blob], 'equipos-formados.png', {
          type: 'image/png',
        });

        // Create share message
        const message = `⚽ Equipos sorteados en ${shareData.groupName}\n\n${shareData.teamAName} vs ${shareData.teamBName}\n\n¡Que gane el mejor equipo! 💪`;

        // Prepare share data with file
        const sharePayload = {
          title: 'Equipos Formados',
          text: message,
          files: [file],
        };

        // Check if files are supported
        if (navigator.canShare && navigator.canShare(sharePayload)) {
          await navigator.share(sharePayload);
        } else {
          // Fallback: share without files
          await navigator.share({
            title: 'Equipos Formados',
            text: message,
          });
        }

        console.log('Shared successfully via Web Share API');
      } catch (error) {
        console.error('Error sharing via Web Share API:', error);
        throw error;
      }
    },
    []
  );

  const shareTeamsScreenshot = useCallback(
    async (sortCount: number, shareData: ShareData): Promise<void> => {
      let loadingToastId: any;

      try {
        // Show loading message
        loadingToastId = showLoadingToast('Generando captura de equipos...');

        // Find the element with dynamic ID
        let element = document.getElementById(
          `teams-list-container-${sortCount}`
        );

        // Fallback to the base ID if dynamic ID doesn't exist
        if (!element) {
          element = document.getElementById('teams-list-container');
        }

        // Try to find any teams container if specific IDs don't work
        if (!element) {
          const containers = document.querySelectorAll(
            '[id^="teams-list-container"]'
          );
          if (containers.length > 0) {
            element = containers[0] as HTMLElement;
          }
        }

        if (!element) {
          throw new Error('No se encontró el contenedor de equipos');
        }

        console.log('Found element for screenshot:', {
          id: element.id,
          offsetWidth: element.offsetWidth,
          offsetHeight: element.offsetHeight,
        });

        // Take screenshot
        const dataUrl = await takeScreenshot(element);

        if (!dataUrl) {
          throw new Error('No se pudo generar la captura');
        }

        // Update loading message
        if (loadingToastId) {
          // Clear previous loading toast
          loadingToastId = showLoadingToast('Copiando al portapapeles...');
        }

        // Copy to clipboard
        await copyToClipboard(dataUrl);

        // Clear loading toast
        if (loadingToastId) {
          // The loading toast will be automatically cleared by the success toast
        }

        // Show success message using existing toast service
        showSuccessToast('📱 Captura copiada al portapapeles');

        // Try to share via Web Share API
        try {
          await shareViaWebShare(dataUrl, shareData);
        } catch (shareError) {
          console.log(
            'Web Share API failed, but clipboard copy succeeded:',
            shareError
          );
          // Don't throw error here as clipboard copy was successful
        }
      } catch (error) {
        console.error('Error in shareTeamsScreenshot:', error);

        // Clear loading toast on error
        if (loadingToastId) {
          // The loading toast will be automatically cleared by the error toast
        }

        showErrorToast(
          'Error al compartir: ' +
            (error instanceof Error ? error.message : 'Error desconocido')
        );
      }
    },
    [takeScreenshot, copyToClipboard, shareViaWebShare]
  );

  return {
    shareTeamsScreenshot,
  };
};
