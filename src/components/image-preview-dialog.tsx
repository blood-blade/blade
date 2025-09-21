'use client';
import { useState, useEffect, useRef } from 'react';
import NextImage from 'next/image';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, File as FileIcon, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImagePreviewDialogProps {
  file: File;
  onSend: (file: File, message: string) => Promise<any>;
  onCancel: () => void;
  mode: 'chat' | 'story' | 'avatar';
}

/**
 * Creates a centered, aspect-ratio-constrained crop rectangle.
 * @param mediaWidth The width of the media element.
 * @param mediaHeight The height of the media element.
 * @param aspect The desired aspect ratio.
 * @returns A Crop object.
 */
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

/**
 * Generates a cropped, circular image from a source image and a crop object.
 * This function correctly handles image scaling and device pixel ratio for high-quality output.
 * @param image The source HTMLImageElement.
 * @param crop The crop parameters from ReactCrop (in percentages).
 * @param fileName The desired filename for the output file.
 * @returns A promise that resolves with the cropped image as a File object.
 */
async function getCroppedCircularImage(
  image: HTMLImageElement,
  crop: Crop,
  fileName: string
): Promise<File> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context is not available');
  }

  // --- Avatar Cropping Logic ---
  // The following section implements the high-quality circular crop.

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio || 1;

  // The crop object uses percentages, so we calculate the source crop region in pixels.
  const cropX = (crop.x / 100) * image.naturalWidth;
  const cropY = (crop.y / 100) * image.naturalHeight;
  const cropWidth = (crop.width / 100) * image.naturalWidth;
  const cropHeight = (crop.height / 100) * image.naturalHeight;
  
  // Set canvas dimensions to the actual crop size, scaled for high DPI.
  canvas.width = Math.floor(cropWidth * pixelRatio);
  canvas.height = Math.floor(cropHeight * pixelRatio);

  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = 'high';

  // Center the drawing within the canvas
  const centerX = cropWidth / 2;
  const centerY = cropHeight / 2;
  const radius = Math.min(centerX, centerY);
  
  // Create a circular clipping path. Anything drawn after this will be confined to the circle.
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  ctx.clip();

  // Draw the cropped portion of the source image onto the canvas.
  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );
  
  // --- End of Avatar Cropping Logic ---

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      // Resolve with a new File object. Using PNG to preserve transparency outside the circle.
      resolve(new File([blob], fileName, { type: 'image/png' }));
    }, 'image/png', 1); // Use PNG for transparency and high quality.
  });
}


export function ImagePreviewDialog({ file, onSend, onCancel, mode }: ImagePreviewDialogProps) {
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!file || !file.type) {
      onCancel();
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, onCancel]);

  /**
   * When an image loads, automatically set a centered square crop if in 'avatar' mode.
   */
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
    if (mode === 'avatar') {
      const { width, height } = e.currentTarget;
      // Set a centered, 1:1 aspect ratio crop.
      setCrop(centerAspectCrop(width, height, 1 / 1));
    }
  };

  const handleSend = async () => {
    setIsSending(true);

    let fileToSend = file;

    try {
      // --- File Generation Logic ---
      // If in avatar mode, generate the cropped file before sending.
      if (mode === 'avatar' && imgRef.current && crop?.width && crop?.height) {
        fileToSend = await getCroppedCircularImage(imgRef.current, crop, 'avatar.png');
      }
      // For 'chat' and 'story' modes, fileToSend remains the original file.
      
      await onSend(fileToSend, message);

    } catch (error) {
      console.error('Image upload/crop failed:', error);
      toast({
        title: "Action Failed",
        description: "Could not process the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      onCancel();
    }
  };

  if (!file || !file.type) return null;

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  const getTitle = () => {
    switch (mode) {
      case 'story': return "Post a Story";
      case 'avatar': return "Set New Avatar";
      default: return "Send File";
    }
  }

  const getButtonText = () => {
    switch (mode) {
      case 'story': return "Post Story";
      case 'avatar': return "Set as Avatar";
      default: return "Send";
    }
  }

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center p-4 bg-muted/30 rounded-lg max-h-[50vh] min-h-[200px]">
          {isImage && previewUrl && (
            mode === 'avatar' ? (
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                circularCrop
                aspect={1}
              >
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Image preview"
                  style={{ maxHeight: '50vh', display: 'block' }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            ) : (
              <NextImage
                src={previewUrl}
                alt="Image preview"
                width={500}
                height={500}
                style={{ objectFit: 'contain', maxHeight: '50vh', width: 'auto', height: 'auto' }}
              />
            )
          )}
          {isVideo && previewUrl && (
              <video src={previewUrl} controls className="max-h-[50vh] rounded-lg" />
          )}
          {!isImage && !isVideo && (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <FileIcon className="w-16 h-16"/>
              <p className="font-semibold">{file.name}</p>
              <p className="text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          )}
        </div>

        {mode !== 'avatar' && (
          <div className="relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={mode === 'story' ? 'Add a caption...' : 'Add a message...'}
              className="pr-20"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onCancel} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSending ? 'Sending...' : getButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
