import React from 'react';

const FallbackCropper = ({ imageUrl, onCancel, onCropComplete }) => {
    return (
        <div className="image-cropper">
            <div style={{
                backgroundColor: '#fff',
                padding: '20px',
                borderRadius: '8px',
                maxWidth: '500px',
                width: '90%'
            }}>
                <h3 style={{ marginBottom: '15px', textAlign: 'center' }}>
                    Image Cropper Unavailable
                </h3>
                <p style={{ marginBottom: '20px' }}>
                    The cropper functionality couldn't be loaded. Your image will be uploaded as is.
                </p>
                <div style={{ textAlign: 'center' }}>
                    <img
                        src={imageUrl}
                        alt="Preview"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            marginBottom: '20px'
                        }}
                    />
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px'
                }}>
                    <button
                        onClick={onCancel}
                        className="cancel-button"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            // Create a blob from the image URL
                            fetch(imageUrl)
                                .then(res => res.blob())
                                .then(blob => {
                                    onCropComplete(blob);
                                })
                                .catch(err => {
                                    console.error("Error creating blob:", err);
                                    onCancel();
                                });
                        }}
                        className="crop-button"
                    >
                        Use Image
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FallbackCropper;
