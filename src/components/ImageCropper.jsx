// FIXED: ImageCropper.js (updates aspect ratio support and sizing)
import React, { useState, useRef, useEffect } from 'react';
import ReactCrop from 'react-image-crop';



const ImageCropper = ({
    imageUrl,
    aspect,
    onCropComplete,
    onCancel,
    circularCrop = false,
}) => {
    const [crop, setCrop] = useState({
        unit: '%',
        width: 90,
        x: 5,
        y: 5,
        aspect: aspect || undefined,
    });
    const [completedCrop, setCompletedCrop] = useState(null);
    const [originalFile, setOriginalFile] = useState(null);
    const imgRef = useRef(null);

    // Retrieve original file info from sessionStorage
    useEffect(() => {
        try {
            const fileInfo = JSON.parse(sessionStorage.getItem('currentUploadFile'));
            if (fileInfo) {
                setOriginalFile(fileInfo);
            }
        } catch (error) {
            console.error("Error retrieving original file info:", error);
        }
    }, []);

    const onImageLoad = (e) => {
        const { width, height } = e.currentTarget;
        setCrop({
            unit: '%',
            width: 90,
            x: 5,
            y: 5,
            aspect: aspect || undefined,
        });
    };

    const handleComplete = async () => {
        if (!completedCrop || !imgRef.current) return;

        const image = imgRef.current;
        const canvas = document.createElement('canvas');

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        const cropX = completedCrop.x * scaleX;
        const cropY = completedCrop.y * scaleY;
        const cropWidth = completedCrop.width * scaleX;
        const cropHeight = completedCrop.height * scaleY;

        canvas.width = cropWidth;
        canvas.height = cropHeight;

        const ctx = canvas.getContext('2d');

        if (circularCrop) {
            ctx.beginPath();
            ctx.arc(
                canvas.width / 2,
                canvas.height / 2,
                Math.min(canvas.width, canvas.height) / 2,
                0,
                2 * Math.PI
            );
            ctx.clip();
        }

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

        // Use webP format if the original was webP
        const isWebP = originalFile && originalFile.type === 'image/webp';
        const mimeType = isWebP ? 'image/webp' : 'image/jpeg';
        const quality = isWebP ? 0.95 : 0.95;

        canvas.toBlob(
            (blob) => {
                if (!blob) return console.error('Failed to create cropped blob.');
                // Pass the original file information to handleCropComplete
                onCropComplete(blob, originalFile);
                // Clean up session storage
                sessionStorage.removeItem('currentUploadFile');
            },
            mimeType,
            quality
        );
    };

    return (
        <div className="image-cropper">
            <div className="cropper-container">
                <ReactCrop
                    crop={crop}
                    onChange={(newCrop) => setCrop(newCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={aspect}
                >
                    <img
                        ref={imgRef}
                        src={imageUrl}
                        alt="To crop"
                        onLoad={onImageLoad}
                        style={{ maxHeight: '70vh' }}
                    />
                </ReactCrop>
            </div>
            <div className="cropper-controls">
                <button className="cancel-button" type="button" onClick={onCancel}>
                    Cancel
                </button>
                <button className="crop-button" type="button" onClick={handleComplete}>
                    Crop & Save
                </button>
            </div>
            <div className="cropper-instructions">
                <p>Drag to position • Resize from corners</p>
                {originalFile && originalFile.type === 'image/webp' && (
                    <p className="format-note">WebP format will be preserved</p>
                )}
            </div>
        </div>
    );
};

export default ImageCropper;
