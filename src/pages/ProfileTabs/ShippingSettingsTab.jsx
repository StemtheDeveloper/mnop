
import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';

const ShippingSettingsTab = () => {
  const { currentUser, hasRole } = useUser();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [shippingSettings, setShippingSettings] = useState({
    standardShippingCost: 10,
    expressShippingCost: 25,
    shippingProvider: 'standard',
    customProviderName: '',
    offerFreeShipping: false,
    freeShippingThreshold: 0,
    freeExpressShipping: false,
    useCustomShipping: true
  });
  const [loadingShippingSettings, setLoadingShippingSettings] = useState(false);

  // Define shipping providers options
  const shippingProviders = [
    { id: 'standard', name: 'Standard Shipping' },
    { id: 'ups', name: 'UPS' },
    { id: 'fedex', name: 'FedEx' },
    { id: 'usps', name: 'USPS' },
    { id: 'dhl', name: 'DHL' },
    { id: 'custom', name: 'Custom Provider' }
  ];

  // Fetch shipping settings for the designer
  useEffect(() => {
    const fetchShippingSettings = async () => {
      if (!currentUser?.uid || !hasRole('designer')) return;

      setLoadingShippingSettings(true);
      try {
        const settingsRef = doc(db, 'designerSettings', currentUser.uid);
        const settingsDoc = await getDoc(settingsRef);

        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setShippingSettings({
            standardShippingCost: data.standardShippingCost || 10,
            expressShippingCost: data.expressShippingCost || 25,
            shippingProvider: data.shippingProvider || 'standard',
            customProviderName: data.customProviderName || '',
            offerFreeShipping: data.offerFreeShipping || false,
            freeShippingThreshold: data.freeShippingThreshold || 0,
            freeExpressShipping: data.freeExpressShipping || false,
            useCustomShipping: data.useCustomShipping !== undefined ? data.useCustomShipping : true
          });
        }
        setLoadingShippingSettings(false);
      } catch (error) {
        console.error("Error loading shipping settings:", error);
        setLoadingShippingSettings(false);
      }
    };

    fetchShippingSettings();
  }, [currentUser?.uid, hasRole]);

  const handleSaveShippingSettings = async () => {
    if (!currentUser?.uid || !hasRole('designer')) return;

    setLoading(true);
    try {
      const settingsRef = doc(db, 'designerSettings', currentUser.uid);
      await setDoc(settingsRef, {
        standardShippingCost: parseFloat(shippingSettings.standardShippingCost) || 10,
        expressShippingCost: parseFloat(shippingSettings.expressShippingCost) || 25,
        shippingProvider: shippingSettings.shippingProvider,
        customProviderName: shippingSettings.customProviderName,
        offerFreeShipping: shippingSettings.offerFreeShipping,
        freeShippingThreshold: parseFloat(shippingSettings.freeShippingThreshold) || 0,
        freeExpressShipping: shippingSettings.freeExpressShipping,
        useCustomShipping: shippingSettings.useCustomShipping,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setMessage({ type: 'success', text: "Shipping settings saved successfully" });
    } catch (error) {
      console.error("Error saving shipping settings:", error);
      setMessage({ type: 'error', text: "Failed to save shipping settings. Please try again." });
    } finally {
      setLoading(false);
    }
  };
  return (<div className="settings-section shipping-settings-section">
    <h3>Shipping Settings</h3>
    <p>Configure default shipping costs and options for all your products</p>

    {loadingShippingSettings ? (
      <div className="loading-container">
        <LoadingSpinner />
        <p>Loading shipping settings...</p>
      </div>
    ) : (
      <form onSubmit={(e) => {
        e.preventDefault();
        handleSaveShippingSettings();
      }}>
        <div className="form-row">
          <div className="form-group form-field-half">
            <label htmlFor="standardShippingCost">Standard Shipping Cost ($)</label>
            <input
              type="number"
              id="standardShippingCost"
              value={shippingSettings.standardShippingCost}
              onChange={(e) => setShippingSettings({
                ...shippingSettings,
                standardShippingCost: parseFloat(e.target.value) || 0
              })}
              min="0"
              step="0.01"
            />
            <p className="field-description">This is your default shipping cost applied to all products</p>
          </div>

          <div className="form-group form-field-half">
            <label htmlFor="expressShippingCost">Express Shipping Cost ($)</label>
            <input
              type="number"
              id="expressShippingCost"
              value={shippingSettings.expressShippingCost}
              onChange={(e) => setShippingSettings({
                ...shippingSettings,
                expressShippingCost: parseFloat(e.target.value) || 0
              })}
              min="0"
              step="0.01"
            />
            <p className="field-description">Cost for express shipping option</p>
          </div>
        </div>

        <div className="form-group checkbox">
          <input
            type="checkbox"
            id="offerFreeShipping"
            checked={shippingSettings.offerFreeShipping}
            onChange={(e) => setShippingSettings({
              ...shippingSettings,
              offerFreeShipping: e.target.checked
            })}
          />
          <label htmlFor="offerFreeShipping">Offer free shipping on orders above a threshold</label>
        </div>

        {shippingSettings.offerFreeShipping && (
          <div className="form-group">
            <label htmlFor="freeShippingThreshold">Free Shipping Threshold ($)</label>
            <input
              type="number"
              id="freeShippingThreshold"
              value={shippingSettings.freeShippingThreshold}
              onChange={(e) => setShippingSettings({
                ...shippingSettings,
                freeShippingThreshold: parseFloat(e.target.value) || 0
              })}
              min="0"
              step="0.01"
            />
            <p className="field-description">Orders above this amount will receive free shipping</p>
          </div>
        )}

        <div className="form-group checkbox">
          <input
            type="checkbox"
            id="freeExpressShipping"
            checked={shippingSettings.freeExpressShipping}
            onChange={(e) => setShippingSettings({
              ...shippingSettings,
              freeExpressShipping: e.target.checked
            })}
          />
          <label htmlFor="freeExpressShipping">Offer free express shipping on orders above a threshold</label>
        </div>

        <div className="form-group">
          <label htmlFor="shippingProvider">Preferred Shipping Provider</label>
          <select
            id="shippingProvider"
            value={shippingSettings.shippingProvider}
            onChange={(e) => {
              const useCustom = e.target.value === 'custom';
              setShippingSettings({
                ...shippingSettings,
                shippingProvider: e.target.value,
                useCustomShipping: useCustom
              });
            }}
          >
            {shippingProviders.map(provider => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
        </div>

        {shippingSettings.shippingProvider === 'custom' && (
          <div className="form-group">
            <label htmlFor="customProviderName">Custom Provider Name</label>
            <input
              type="text"
              id="customProviderName"
              value={shippingSettings.customProviderName}
              onChange={(e) => setShippingSettings({
                ...shippingSettings,
                customProviderName: e.target.value
              })}></input>
            <label htmlFor="shippingProvider">Preferred Shipping Provider</label>
            <select
              id="shippingProvider"
              value={shippingSettings.shippingProvider}
              onChange={(e) => {
                const useCustom = e.target.value === 'custom';
                setShippingSettings({
                  ...shippingSettings,
                  shippingProvider: e.target.value,
                  useCustomShipping: useCustom
                });
              }}
            >
              {shippingProviders.map(provider => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </div>
        )}
        {shippingSettings.shippingProvider === 'custom' && (
          <div className="form-group">
            <label htmlFor="customProviderName">Custom Provider Name</label>
            <input
              type="text"
              id="customProviderName"
              value={shippingSettings.customProviderName}
              onChange={(e) => setShippingSettings({
                ...shippingSettings,
                customProviderName: e.target.value
              })}
              placeholder="Enter your custom shipping provider's name"
            />
          </div>
        )}

        <div className="shipping-settings-info">
          <h4>How shipping costs apply to your products:</h4>
          <ul>
            <li>These standard and express shipping costs will be used as default for all your products</li>
            <li>You can override these settings for specific products when creating or editing them</li>
            <li>Free shipping threshold applies across all your products unless overridden</li>
          </ul>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Shipping Settings'}
          </button>
        </div>
      </form>
    )}
  </div>);
};

export default ShippingSettingsTab;
