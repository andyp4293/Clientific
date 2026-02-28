'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';

type Tab = 'profile' | 'branding' | 'integrations' | 'notifications' | 'ai-receptionist';

interface Business {
  id: string;
  name: string;
  slug: string;
  publicId: string;
  email: string;
  businessType: string;
  phone: string;
  businessEmail: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  timezone: string;
  logoUrl: string | null;
  enableOnlineBooking: boolean;
  googleReviewUrl: string | null;
  facebookPageUrl: string | null;
  yelpUrl: string | null;
  instagramUrl: string | null;
  aiReceptionistEnabled: boolean;
  aiReceptionistPhone: string | null;
  aiReceptionistGreeting: string | null;
  vapiPhoneNumber: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [formData, setFormData] = useState<Partial<Business>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [activatingUntil, setActivatingUntil] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!activatingUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((activatingUntil.getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setActivatingUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activatingUntil]);

  // Fetch business data
  const { data, isLoading } = useQuery({
    queryKey: ['business-info'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business');
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.business) {
      setFormData(data.business);
      setLogoPreview(data.business.logoUrl);
    }
  }, [data]);

  const business: Business | undefined = data?.business;

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Business>) => {
      const res = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update business');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-info'] });
    },
  });

  // Dedicated mutation for AI receptionist toggle — fires immediately, no Save needed
  const aiToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiReceptionistEnabled: enabled }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update');
      }
      return res.json();
    },
    onSuccess: (data) => {
      const newNumber = data.business.vapiPhoneNumber ?? null;
      setFormData(prev => {
        if (newNumber && !prev.vapiPhoneNumber) {
          // Number was just provisioned — start 2-minute activation countdown
          setActivatingUntil(new Date(Date.now() + 2 * 60 * 1000));
        }
        return {
          ...prev,
          aiReceptionistEnabled: data.business.aiReceptionistEnabled,
          vapiPhoneNumber: newNumber,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['business-info'] });
    },
  });

  const handleEnableConfirm = () => {
    setShowEnableModal(false);
    setFormData(prev => ({ ...prev, aiReceptionistEnabled: true }));
    aiToggleMutation.mutate(true);
  };

  const handleDisableConfirm = () => {
    setShowDisableModal(false);
    setFormData(prev => ({ ...prev, aiReceptionistEnabled: false, vapiPhoneNumber: null }));
    aiToggleMutation.mutate(false);
  };

  const handleInputChange = (field: keyof Business, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressSelect = (address: any) => {
    setFormData((prev) => ({
      ...prev,
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country || 'United States',
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    setUploadingLogo(true);

    try {
      // For now, convert to base64 and store directly
      // In production, you'd upload to a service like S3, Cloudinary, etc.
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        setFormData((prev) => ({ ...prev, logoUrl: base64String }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setFormData((prev) => ({ ...prev, logoUrl: null }));
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const businessTypes = [
    'Salon',
    'Spa',
    'Gym',
    'Restaurant',
    'Medical/Dental',
    'Auto Service',
    'Retail',
    'Professional Services',
    'Other',
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Business Profile', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'branding', label: 'Branding & Logo', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
    { id: 'integrations', label: 'Integrations', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { id: 'ai-receptionist', label: 'AI Receptionist', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your business settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-8 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card p-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h3>
              
              {/* Business Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="input"
                  placeholder="Your Business Name"
                />
              </div>

              {/* Business Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Type *
                </label>
                <select
                  value={formData.businessType || ''}
                  onChange={(e) => handleInputChange('businessType', e.target.value)}
                  className="input"
                >
                  {businessTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="input"
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Business Email */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Email
                </label>
                <input
                  type="email"
                  value={formData.businessEmail || ''}
                  onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                  className="input"
                  placeholder="contact@yourbusiness.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Public email shown to customers (optional)
                </p>
              </div>              {/* Address */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address
                </label>
                <AddressAutocomplete
                  onAddressSelect={handleAddressSelect}
                  defaultValue={formData.street || ''}
                />
              </div>

              {/* City, State, Zip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="input"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state || ''}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="input"
                    placeholder="State"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode || ''}
                    onChange={(e) => handleInputChange('zipCode', e.target.value)}
                    className="input"
                    placeholder="12345"
                  />
                </div>
              </div>

              {/* Timezone */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={formData.timezone || ''}
                  onChange={(e) => handleInputChange('timezone', e.target.value)}
                  className="input"
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="America/Phoenix">Arizona</option>
                  <option value="America/Anchorage">Alaska</option>
                  <option value="Pacific/Honolulu">Hawaii</option>
                </select>
              </div>

              {/* Public ID & Booking URL */}
              {business?.publicId && typeof window !== 'undefined' && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="block text-sm font-medium text-blue-900 mb-2">                  Your Booking URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={`${window.location.origin}/book/${business.publicId}`}
                      readOnly
                      className="input flex-1 bg-white"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/book/${business.publicId}`);
                        alert('Copied to clipboard!');
                      }}
                      className="btn-outline"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    Share this link with customers to book appointments
                  </p>
                </div>
              )}

              {/* Online Booking Toggle */}
              <div className="mb-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enableOnlineBooking ?? true}
                    onChange={(e) => handleInputChange('enableOnlineBooking', e.target.checked)}
                    className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Enable Online Booking</span>
                    <p className="text-xs text-gray-500">Allow customers to book appointments online</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Logo & Branding</h3>
              
              {/* Logo Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Logo
                </label>
                <div className="flex items-start gap-6">
                  {/* Logo Preview */}
                  <div className="flex-shrink-0">
                    {logoPreview ? (
                      <div className="relative group">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <button
                          onClick={handleRemoveLogo}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Upload Button */}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className={`btn-outline cursor-pointer inline-block ${
                        uploadingLogo ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      Recommended: Square image, at least 200x200px, max 2MB
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Your logo will appear on your booking page and in customer emails
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media & Review Links</h3>
              <p className="text-sm text-gray-600 mb-6">
                Add links to your social profiles and review pages. These will be shown on your booking page.
              </p>

              {/* Google Reviews */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Review URL
                </label>
                <input
                  type="url"
                  value={formData.googleReviewUrl || ''}
                  onChange={(e) => handleInputChange('googleReviewUrl', e.target.value)}
                  className="input"
                  placeholder="https://g.page/..."
                />
              </div>

              {/* Facebook */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facebook Page URL
                </label>
                <input
                  type="url"
                  value={formData.facebookPageUrl || ''}
                  onChange={(e) => handleInputChange('facebookPageUrl', e.target.value)}
                  className="input"
                  placeholder="https://facebook.com/..."
                />
              </div>

              {/* Yelp */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Yelp URL
                </label>
                <input
                  type="url"
                  value={formData.yelpUrl || ''}
                  onChange={(e) => handleInputChange('yelpUrl', e.target.value)}
                  className="input"
                  placeholder="https://yelp.com/biz/..."
                />
              </div>

              {/* Instagram */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instagram URL
                </label>
                <input
                  type="url"
                  value={formData.instagramUrl || ''}
                  onChange={(e) => handleInputChange('instagramUrl', e.target.value)}
                  className="input"
                  placeholder="https://instagram.com/..."
                />
              </div>
            </div>
          </div>
        )}

        {/* AI Receptionist Tab */}
        {activeTab === 'ai-receptionist' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">AI Phone Receptionist</h3>
              <p className="text-sm text-gray-600 mb-6">
                Let AI answer your business calls 24/7. It handles questions about services, hours, and pricing — and transfers to your personal phone if the caller asks to speak with a real person.
              </p>

              {/* Enable Toggle */}
              <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.aiReceptionistEnabled ?? false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setShowEnableModal(true);
                      } else {
                        setShowDisableModal(true);
                      }
                    }}
                    className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Enable AI Receptionist</span>
                    <p className="text-xs text-gray-500">A dedicated phone number will be set up for your business</p>
                  </div>
                </label>
              </div>

              {/* Forwarding Phone */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transfer-to Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.aiReceptionistPhone || ''}
                  onChange={(e) => handleInputChange('aiReceptionistPhone', e.target.value)}
                  className="input"
                  placeholder="(555) 123-4567"
                />
                <p className="text-xs text-gray-500 mt-1">
                  When a caller asks for a real person, the AI will transfer the call here (e.g. your personal cell)
                </p>
              </div>

              {/* Custom Greeting */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Greeting <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.aiReceptionistGreeting || ''}
                  onChange={(e) => handleInputChange('aiReceptionistGreeting', e.target.value)}
                  className="input"
                  placeholder={`Hi, thank you for calling ${formData.name || 'us'}. How can I help you today?`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to use the default greeting above
                </p>
              </div>

              {/* Vapi phone number */}
              {formData.aiReceptionistEnabled && (
                <div className="mb-6">
                  {formData.vapiPhoneNumber ? (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-green-900 mb-1">Your AI Receptionist Number</p>
                      {activatingUntil ? (
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                          <p className="text-xs text-yellow-700 font-medium">
                            Activating — ready in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <p className="text-xs text-green-700 font-medium">Active — ready to receive calls</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          value={formData.vapiPhoneNumber}
                          readOnly
                          className="input flex-1 bg-white text-sm font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(formData.vapiPhoneNumber!);
                            alert('Copied to clipboard!');
                          }}
                          className="btn-outline whitespace-nowrap"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-sm text-green-800 font-medium mb-3">
                        → Update your Google Business Profile with this number — that&apos;s all you need to do.
                      </p>
                      <details className="border border-green-200 rounded-lg bg-white">
                        <summary className="px-3 py-2 cursor-pointer text-sm text-green-700 hover:bg-green-50 rounded-lg">
                          Already have a number? Forward calls to this number
                        </summary>
                        <div className="px-3 pb-3 pt-2 space-y-1 text-xs text-gray-600">
                          <p><strong>iPhone:</strong> Settings → Phone → Call Forwarding → enter {formData.vapiPhoneNumber}</p>
                          <p><strong>Android:</strong> Phone app → Settings → Call Forwarding → Always forward → enter {formData.vapiPhoneNumber}</p>
                          <p><strong>Google Voice:</strong> Settings → Calls → Forward calls → Add forwarding number</p>
                          <p><strong>Other VoIP:</strong> Go to your provider&apos;s call forwarding or routing settings and enter {formData.vapiPhoneNumber}</p>
                        </div>
                      </details>
                    </div>
                  ) : aiToggleMutation.isPending ? (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 flex-shrink-0" />
                      <p className="text-sm text-gray-600">Setting up your AI receptionist number…</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm text-red-800 font-medium mb-2">Setup didn&apos;t complete.</p>
                      <p className="text-sm text-red-700 mb-3">
                        {aiToggleMutation.error?.message || 'Your AI receptionist number couldn\'t be created.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => aiToggleMutation.mutate(true)}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
              <p className="text-sm text-gray-600 mb-6">
                Manage how and when you receive notifications about your business.
              </p>

              <div className="space-y-4">
                {/* Email Notifications */}
                <div className="p-4 border border-gray-200 rounded-lg">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3 mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">New Appointment Notifications</span>
                      <p className="text-xs text-gray-500 mt-1">Receive an email when someone books an appointment</p>
                    </div>
                  </label>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3 mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">Customer Review Notifications</span>
                      <p className="text-xs text-gray-500 mt-1">Get notified when customers leave reviews</p>
                    </div>
                  </label>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3 mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">Weekly Summary</span>
                      <p className="text-xs text-gray-500 mt-1">Receive a weekly digest of your business activity</p>
                    </div>
                  </label>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3 mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">Marketing Tips</span>
                      <p className="text-xs text-gray-500 mt-1">Get occasional tips and best practices for growing your business</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> These settings are coming soon. For now, you'll receive email notifications for critical events like new bookings and payments.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {updateMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">
            {updateMutation.error?.message || 'Failed to update settings'}
          </p>
        </div>
      )}

      {/* Success Message */}
      {updateMutation.isSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">Settings saved successfully!</p>
        </div>
      )}      {/* Enable AI Receptionist Modal */}
      {showEnableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Enable AI Receptionist</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You&apos;re about to set up an AI phone receptionist for <strong>{formData.name}</strong>.
            </p>
            <ul className="space-y-2 mb-4">
              {[
                'A dedicated phone number will be created in your area code',
                'The AI answers calls 24/7 and handles questions about services, hours, and pricing',
                'Callers can book appointments directly over the phone',
                'Transfers to your personal number when someone asks for a real person',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-6">
              Once enabled, update your Google Business Profile with the new number — that&apos;s all you need to do.
            </p>
            {aiToggleMutation.isError && (
              <p className="text-sm text-red-600 mb-4">{aiToggleMutation.error?.message}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowEnableModal(false)} className="btn-outline flex-1">Cancel</button>
              <button onClick={handleEnableConfirm} disabled={aiToggleMutation.isPending} className="btn-primary flex-1">
                {aiToggleMutation.isPending ? 'Setting up…' : 'Enable AI Receptionist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable AI Receptionist Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Disable AI Receptionist?</h3>
            <p className="text-sm text-gray-600 mb-2">
              This will release your dedicated number{formData.vapiPhoneNumber ? <> <strong>{formData.vapiPhoneNumber}</strong></> : ''}.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Any customers who have this number saved will no longer reach your AI receptionist.
            </p>
            {aiToggleMutation.isError && (
              <p className="text-sm text-red-600 mb-4">{aiToggleMutation.error?.message}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowDisableModal(false)} className="btn-outline flex-1">Keep it enabled</button>
              <button
                onClick={handleDisableConfirm}
                disabled={aiToggleMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {aiToggleMutation.isPending ? 'Disabling…' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => {
            setFormData(business || {});
            setLogoPreview(business?.logoUrl || null);
          }}
          className="btn-outline"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="btn-primary"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
