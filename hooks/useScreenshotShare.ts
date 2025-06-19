import { useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { showSuccessToast, showErrorToast } from '../services/toastService';

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
        // Agregar clase para optimizar el diseño para screenshot
        document.body.classList.add('screenshot-mode');

        // Asegurar que el elemento esté visible antes de tomar el screenshot
        element.scrollIntoView({ behavior: 'instant', block: 'center' });

        // Dar tiempo para que se renderice completamente con los nuevos estilos
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const canvas = await html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 2, // Para mejor calidad
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true, // Para SVG y elementos complejos
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: element.scrollWidth,
          height: element.scrollHeight,
          windowWidth: Math.max(element.scrollWidth, 1200),
          windowHeight: Math.max(element.scrollHeight, 800),
          ignoreElements: (el) => {
            // Ignorar botones de admin para que no aparezcan en el screenshot
            return (
              el.classList.contains('admin-button') ||
              el.closest('.admin-buttons') !== null ||
              (el.tagName === 'BUTTON' && !el.closest('#teams-list-container'))
            );
          },
          onclone: (clonedDoc) => {
            // Asegurar que los avatares placeholder se rendericen correctamente
            const avatarElements = clonedDoc.querySelectorAll('.rounded-full');
            avatarElements.forEach((avatar) => {
              // Forzar el renderizado de elementos de avatar
              if (avatar instanceof HTMLElement) {
                avatar.style.border = '1px solid #e5e7eb';
                avatar.style.display = 'flex';
                avatar.style.alignItems = 'center';
                avatar.style.justifyContent = 'center';
              }
            });
          },
        });

        // Remover la clase después del screenshot
        document.body.classList.remove('screenshot-mode');

        return canvas.toDataURL('image/png', 0.9);
      } catch (error) {
        console.error('Error taking screenshot:', error);
        // Asegurar que se remueva la clase en caso de error
        document.body.classList.remove('screenshot-mode');
        showErrorToast('Error al tomar captura de pantalla');
        return null;
      }
    },
    []
  );

  const shareToWhatsApp = useCallback(
    async (elementId: string, shareData: ShareData) => {
      try {
        const element = document.getElementById(elementId);
        if (!element) {
          showErrorToast('No se pudo encontrar el elemento para capturar');
          return;
        }

        // Tomar screenshot
        const imageDataUrl = await takeScreenshot(element);
        if (!imageDataUrl) return;

        // Convertir data URL a blob
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();

        // Crear mensaje para compartir
        const message = `⚽ Equipos sorteados en ${shareData.groupName}\n\n${shareData.teamAName} vs ${shareData.teamBName}\n\n¡Que gane el mejor equipo! 💪`;

        // Verificar si el navegador soporta Web Share API con archivos
        if (navigator.share) {
          const shareOptions = {
            title: 'Equipos Formados',
            text: message,
            files: [new File([blob], 'equipos.png', { type: 'image/png' })],
          };

          // Intentar compartir con archivos primero
          if (navigator.canShare && navigator.canShare(shareOptions)) {
            try {
              await navigator.share(shareOptions);
              showSuccessToast('Compartido exitosamente');
              return;
            } catch (error: any) {
              if (error.name !== 'AbortError') {
                console.error('Error sharing with files:', error);
              } else {
                return; // Usuario canceló el share
              }
            }
          }

          // Si no se puede compartir con archivos, intentar solo con texto
          try {
            await navigator.share({
              title: 'Equipos Formados',
              text: message,
            });

            // Descargar la imagen por separado
            downloadImage(imageDataUrl, 'equipos-formados.png');
            showSuccessToast('Mensaje compartido e imagen descargada');
            return;
          } catch (error: any) {
            if (error.name !== 'AbortError') {
              console.error('Error sharing text:', error);
            } else {
              return; // Usuario canceló el share
            }
          }
        }

        // Fallback para dispositivos móviles: descargar imagen
        if (
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          )
        ) {
          // Descargar la imagen
          downloadImage(imageDataUrl, 'equipos-formados.png');

          // Copiar mensaje al portapapeles si es posible
          try {
            await navigator.clipboard.writeText(message);
            showSuccessToast(
              'Imagen descargada y mensaje copiado. Puedes compartir en cualquier app'
            );
          } catch {
            showSuccessToast(
              'Imagen descargada. Compártela en tu app favorita'
            );
          }
        } else {
          // Para desktop: mostrar modal con opciones
          downloadImage(imageDataUrl, 'equipos-formados.png');

          // Copiar mensaje al portapapeles
          try {
            await navigator.clipboard.writeText(message);
            showSuccessToast(
              'Imagen descargada y mensaje copiado al portapapeles'
            );
          } catch {
            showSuccessToast('Imagen descargada');
          }
        }
      } catch (error) {
        console.error('Error sharing to WhatsApp:', error);
        showErrorToast('Error al compartir');
      }
    },
    [takeScreenshot]
  );

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    shareToWhatsApp,
    takeScreenshot,
  };
};
