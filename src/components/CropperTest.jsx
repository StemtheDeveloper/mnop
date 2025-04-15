import React, { useState } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const CropperTest = () => {
    const [crop, setCrop] = useState({
        unit: '%',
        width: 50,
        height: 50,
        x: 25,
        y: 25,
    });

    return (
        <div style={{ padding: '20px' }}>
            <h2>Cropper Test</h2>
            <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
            >
                <img src="https://via.placeholder.com/400" alt="Test" />
            </ReactCrop>
        </div>
    );
};

export default CropperTest;
