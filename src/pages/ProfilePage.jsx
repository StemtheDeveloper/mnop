import React, { useState } from 'react';

const ProfilePage = () => {
    const [profilePhoto, setProfilePhoto] = useState('');
    const [background, setBackground] = useState('');
    const [bio, setBio] = useState('');

    const handlePhotoChange = (e) => {
        setProfilePhoto(URL.createObjectURL(e.target.files[0]));
    };

    const handleBackgroundChange = (e) => {
        setBackground(URL.createObjectURL(e.target.files[0]));
    };

    const handleBioChange = (e) => {
        setBio(e.target.value);
    };

    return (
        <div style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', padding: '20px' }}>
            <div>
                <input type="file" onChange={handlePhotoChange} />
                {profilePhoto && <img src={profilePhoto} alt="Profile" style={{ width: '150px', height: '150px', borderRadius: '50%' }} />}
            </div>
            <div>
                <input type="file" onChange={handleBackgroundChange} />
            </div>
            <div>
                <textarea value={bio} onChange={handleBioChange} placeholder="Enter your bio" />
            </div>
        </div>
    );
};

export default ProfilePage;
