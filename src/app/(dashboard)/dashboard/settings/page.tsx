'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { toast } from 'sonner';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    });
    image.addEventListener('error', reject);
    image.src = imageSrc;
  });
}

type Tab = 'profile' | 'branding' | 'integrations' | 'notifications' | 'loyalty' | 'ai-receptionist';

function BookingQRCode({ bookingUrl, businessName }: { bookingUrl: string; businessName: string }) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  function downloadPng() {
    const canvas = canvasContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${businessName.toLowerCase().replace(/\s+/g, '-')}-booking-qr.png`;
    a.click();
  }

  function downloadSvg() {
    const svg = document.getElementById('booking-qr-svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${businessName.toLowerCase().replace(/\s+/g, '-')}-booking-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
        Booking QR Code
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
        A QR code lets customers open your booking page by pointing their phone camera at it. No typing, no app download needed. Print it on flyers, receipts, appointment reminder cards, or your front desk display to give walk-in customers an instant way to book.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div ref={canvasContainerRef} className="bg-white p-3 rounded-lg border border-gray-200 shrink-0">
          <QRCodeCanvas value={bookingUrl} size={160} level="M" />
        </div>
        <div className="hidden">
          <QRCodeSVG id="booking-qr-svg" value={bookingUrl} size={400} level="M" />
        </div>
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Download as PNG for print or SVG for digital use (scales to any size without losing quality).
          </p>
          <div className="flex gap-2 justify-center sm:justify-start">
            <button onClick={downloadPng} className="btn-primary text-sm py-1.5 px-3">
              Download PNG
            </button>
            <button onClick={downloadSvg} className="btn-outline text-sm py-1.5 px-3">
              Download SVG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  publicProfileHeadline: string | null;
  publicProfileAbout: string | null;
  publicProfileShowPhone: boolean;
  publicProfileShowEmail: boolean;
  publicProfileShowAddress: boolean;
  publicProfileShowHours: boolean;
  publicProfileShowServices: boolean;
  publicProfileShowTeam: boolean;
  publicProfileShowSocialLinks: boolean;
  enableOnlineBooking: boolean;
  googleReviewUrl: string | null;
  facebookPageUrl: string | null;
  yelpUrl: string | null;
  instagramUrl: string | null;
  aiReceptionistEnabled: boolean;
  aiReceptionistPhone: string | null;
  aiReceptionistGreeting: string | null;
  aiReceptionistFaq: { question: string; answer: string }[] | null;
  smsAiEnabled: boolean;
  smsAiPhoneNumber: string | null;
  smsAiGreeting: string | null;
  vapiPhoneNumber: string | null;
  notifyNewBookingEmail: boolean;
  pointsPerDollar: number;
  pointsPerVisit: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [formData, setFormData] = useState<Partial<Business>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [activatingUntil, setActivatingUntil] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Default to first tab on desktop
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024 && !activeTab) {
      setActiveTab('profile');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast.success('Settings saved!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save settings');
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
          smsAiEnabled: Boolean(data.business.smsAiEnabled),
          smsAiPhoneNumber: data.business.smsAiPhoneNumber ?? newNumber,
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
    setFormData(prev => ({
      ...prev,
      aiReceptionistEnabled: false,
      vapiPhoneNumber: null,
      smsAiEnabled: false,
      smsAiPhoneNumber: null,
    }));
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCropApply = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    setUploadingLogo(true);
    try {
      const cropped = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setLogoPreview(cropped);
      setFormData((prev) => ({ ...prev, logoUrl: cropped }));
      setCropModalOpen(false);
      setImageToCrop(null);
    } catch {
      toast.error('Failed to crop image');
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
    { id: 'loyalty', label: 'Loyalty Points', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];
  const unifiedBusinessAiNumber = formData.vapiPhoneNumber || formData.smsAiPhoneNumber || '';

  return (
    <div>
      {/* Header — hidden on mobile when a section is open */}
      <div className={`mb-6 ${activeTab !== null ? 'hidden lg:block' : ''}`}>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your business settings and preferences</p>
      </div>

      <div className="lg:flex lg:gap-6 lg:items-start">
        {/* Sidebar / list navigation */}
        <aside className={`lg:w-56 lg:flex-shrink-0 ${activeTab !== null ? 'hidden lg:block' : ''}`}>
          <div className="card overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-left transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary dark:bg-primary/10'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <svg
                  className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="flex-1">{tab.label}</span>
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </aside>

        {/* Content panel */}
        {activeTab !== null && (
          <div className="flex-1 min-w-0">
            {/* Mobile back button */}
            <button
              onClick={() => setActiveTab(null)}
              className="lg:hidden flex items-center gap-2 mb-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Settings
            </button>

      {/* Tab Content */}
      <div className="card p-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Business Information</h3>
              
              {/* Business Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Business Email
                </label>
                <input
                  type="email"
                  value={formData.businessEmail || ''}
                  onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                  className="input"
                  placeholder="contact@yourbusiness.com"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Public email shown to customers (optional)
                </p>
              </div>              {/* Address */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <>
                  <div className="mb-4 p-4 bg-primary-50 dark:bg-primary/10 rounded-lg border border-primary-200 dark:border-primary/20">
                    <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
                      Your Booking URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={`${window.location.origin}/book/${business.publicId}`}
                        readOnly
                        className="input flex-1 bg-white dark:bg-gray-800"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/book/${business.publicId}`);
                          toast.success('Copied to clipboard!');
                        }}
                        className="btn-outline"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-primary-700 dark:text-primary-300 mt-2">
                      Share this link with customers to book appointments
                    </p>
                  </div>

                  {/* Booking QR Code */}
                  <BookingQRCode bookingUrl={`${window.location.origin}/book/${business.publicId}`} businessName={business.name} />
                </>
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
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable Online Booking</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Allow customers to book appointments online</p>
                  </div>
                </label>
              </div>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Public Profile Content</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Headline
                    </label>
                    <input
                      type="text"
                      maxLength={90}
                      value={formData.publicProfileHeadline || ''}
                      onChange={(e) => handleInputChange('publicProfileHeadline', e.target.value)}
                      className="input"
                      placeholder="e.g., Precision nails and spa care in Brick, NJ."
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {`${(formData.publicProfileHeadline || '').length}/90`}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      About
                    </label>
                    <textarea
                      value={formData.publicProfileAbout || ''}
                      onChange={(e) => handleInputChange('publicProfileAbout', e.target.value)}
                      className="input"
                      rows={4}
                      maxLength={1200}
                      placeholder="Share what customers can expect from your experience, specialties, and atmosphere."
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {`${(formData.publicProfileAbout || '').length}/1200`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Public Profile Visibility</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      key: 'publicProfileShowPhone' as const,
                      label: 'Show phone number',
                      hint: 'Display tap-to-call on your public profile',
                      defaultValue: true,
                    },
                    {
                      key: 'publicProfileShowEmail' as const,
                      label: 'Show email',
                      hint: 'Display your public contact email',
                      defaultValue: true,
                    },
                    {
                      key: 'publicProfileShowAddress' as const,
                      label: 'Show address',
                      hint: 'Display map and directions link',
                      defaultValue: true,
                    },
                    {
                      key: 'publicProfileShowHours' as const,
                      label: 'Show business hours',
                      hint: 'Display weekly open and close times',
                      defaultValue: true,
                    },
                    {
                      key: 'publicProfileShowServices' as const,
                      label: 'Show services',
                      hint: 'Display service list on public profile',
                      defaultValue: true,
                    },
                    {
                      key: 'publicProfileShowTeam' as const,
                      label: 'Show team members',
                      hint: 'Display active staff members',
                      defaultValue: false,
                    },
                    {
                      key: 'publicProfileShowSocialLinks' as const,
                      label: 'Show social links',
                      hint: 'Display Google, Facebook, Yelp, and Instagram links',
                      defaultValue: true,
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(formData[item.key] as boolean | undefined) ?? item.defaultValue}
                        onChange={(e) => handleInputChange(item.key, e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{item.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Appearance</h3>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Theme</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light, dark, or system default</p>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Logo & Branding</h3>
              
              {/* Logo Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
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
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Recommended: Square image, at least 200x200px, max 2MB
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Social Media & Review Links</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Add links to your social profiles and review pages. These will be shown on your booking page.
              </p>

              {/* Google Reviews */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">AI Phone Receptionist</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Let AI answer your business calls 24/7. It handles questions about services, hours, and pricing — and transfers to your personal phone if the caller asks to speak with a real person.
              </p>

              {/* Enable Toggle */}
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
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
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable AI Receptionist</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">A dedicated phone number will be set up for your business</p>
                  </div>
                </label>
              </div>

              {/* Forwarding Phone */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Transfer-to Phone Number
                </label>

                <input
                  type="tel"
                  value={formData.aiReceptionistPhone || ''}
                  onChange={(e) => handleInputChange('aiReceptionistPhone', e.target.value)}
                  className="input"
                  placeholder="(555) 123-4567"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  When a caller asks for a real person, the AI will transfer the call here (e.g. your personal cell)
                </p>
              </div>

              {/* Custom Greeting */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Greeting <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.aiReceptionistGreeting || ''}
                  onChange={(e) => handleInputChange('aiReceptionistGreeting', e.target.value)}
                  className="input"
                  placeholder={`Hi, thank you for calling ${formData.name || 'us'}. How can I help you today?`}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Leave blank to use the default greeting above
                </p>
              </div>

              {/* SMS AI Booking */}
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">SMS AI Booking</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Calls and booking texts share one business number.
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    (formData.smsAiEnabled ?? false) && !!unifiedBusinessAiNumber
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {(formData.smsAiEnabled ?? false) && !!unifiedBusinessAiNumber ? 'Active' : 'Pending setup'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Business AI Number (calls + booking SMS)
                    </label>
                    <input
                      type="tel"
                      value={unifiedBusinessAiNumber}
                      readOnly
                      className="input bg-gray-50 dark:bg-gray-800 text-sm font-mono"
                      placeholder="+18557654989"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Auto-generated when AI receptionist is enabled. This number is managed by Clientific.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      SMS Greeting <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.smsAiGreeting || ''}
                      onChange={(e) => handleInputChange('smsAiGreeting', e.target.value)}
                      className="input"
                      placeholder={`Hi from ${formData.name || 'our business'}. I can help you book by text.`}
                    />
                  </div>
                </div>
              </div>

              {/* FAQ Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      FAQ <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Common questions the AI will answer on calls
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const faq = formData.aiReceptionistFaq ?? [];
                      setFormData(prev => ({
                        ...prev,
                        aiReceptionistFaq: [...faq, { question: '', answer: '' }],
                      }));
                    }}
                    className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>
                {(formData.aiReceptionistFaq ?? []).length === 0 ? (
                  <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-lg px-4 py-6 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-500">No FAQ entries yet. Click &quot;Add&quot; to create one.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(formData.aiReceptionistFaq ?? []).map((item, i) => (
                      <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        {/* Question row */}
                        <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/50">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-4 shrink-0">Q</span>
                          <input
                            type="text"
                            value={item.question}
                            onChange={(e) => {
                              const faq = [...(formData.aiReceptionistFaq ?? [])];
                              faq[i] = { ...faq[i], question: e.target.value };
                              setFormData(prev => ({ ...prev, aiReceptionistFaq: faq }));
                            }}
                            className="flex-1 bg-transparent text-sm font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none"
                            placeholder="e.g. Do you accept walk-ins?"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const faq = (formData.aiReceptionistFaq ?? []).filter((_, idx) => idx !== i);
                              setFormData(prev => ({ ...prev, aiReceptionistFaq: faq }));
                            }}
                            className="p-1 rounded text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        {/* Answer row */}
                        <div className="flex items-start gap-3 px-3 py-2.5 border-t border-gray-100 dark:border-gray-700/60">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-4 shrink-0 mt-0.5">A</span>
                          <textarea
                            value={item.answer}
                            onChange={(e) => {
                              const faq = [...(formData.aiReceptionistFaq ?? [])];
                              faq[i] = { ...faq[i], answer: e.target.value };
                              setFormData(prev => ({ ...prev, aiReceptionistFaq: faq }));
                            }}
                            className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none resize-none"
                            rows={2}
                            placeholder="e.g. Yes, walk-ins are welcome when we have availability."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vapi phone number */}
              {formData.aiReceptionistEnabled && (
                <div className="mb-6">
                  {formData.vapiPhoneNumber ? (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">Your AI Receptionist Number</p>
                      {activatingUntil ? (
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                            Activating — ready in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <p className="text-xs text-green-700 dark:text-green-300 font-medium">Active — ready to receive calls</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          value={formData.vapiPhoneNumber}
                          readOnly
                          className="input flex-1 bg-white dark:bg-gray-800 text-sm font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(formData.vapiPhoneNumber!);
                            toast.success('Copied to clipboard!');
                          }}
                          className="btn-outline whitespace-nowrap"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-3">
                        → Update your Google Business Profile with this number — that&apos;s all you need to do.
                      </p>
                      <details className="border border-green-200 dark:border-green-800 rounded-lg bg-white dark:bg-gray-800">
                        <summary className="px-3 py-2 cursor-pointer text-sm text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg">
                          Already have a number? Forward calls to this number
                        </summary>
                        <div className="px-3 pb-3 pt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <p><strong>iPhone:</strong> Settings → Phone → Call Forwarding → enter {formData.vapiPhoneNumber}</p>
                          <p><strong>Android:</strong> Phone app → Settings → Call Forwarding → Always forward → enter {formData.vapiPhoneNumber}</p>
                          <p><strong>Google Voice:</strong> Settings → Calls → Forward calls → Add forwarding number</p>
                          <p><strong>Other VoIP:</strong> Go to your provider&apos;s call forwarding or routing settings and enter {formData.vapiPhoneNumber}</p>
                        </div>
                      </details>
                    </div>
                  ) : aiToggleMutation.isPending ? (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary flex-shrink-0" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">Setting up your AI receptionist number…</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">Setup didn&apos;t complete.</p>
                      <p className="text-sm text-red-700 dark:text-red-300 mb-3">
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

        {/* Loyalty Tab */}
        {activeTab === 'loyalty' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Points Earning Rules</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Customers earn points automatically on each check-in. Adjust the rates below to match your business.
              </p>

              <div className="space-y-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Points per visit
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={formData.pointsPerVisit ?? 10}
                    onChange={(e) => handleInputChange('pointsPerVisit', Math.max(0, Math.round(Number(e.target.value))))}
                    className="input w-40"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Flat points awarded for each check-in</p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Points per dollar spent
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.pointsPerDollar ?? 1}
                    onChange={(e) => handleInputChange('pointsPerDollar', Math.max(0, Number(e.target.value)))}
                    className="input w-40"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Points awarded per dollar of spend at check-in</p>
                </div>
              </div>

              <div className="mt-2 p-4 bg-primary-50 dark:bg-primary/10 rounded-lg border border-primary-200 dark:border-primary/20">
                <p className="text-sm text-primary-800 dark:text-primary-200">
                  <strong>Referral bonus:</strong> 50 points per successful referral (fixed — configurable in a future update).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Notification Preferences</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Manage how and when you receive notifications about your business.
              </p>

              <div className="space-y-4">
                {/* New Appointment Notifications — functional */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notifyNewBookingEmail ?? true}
                      onChange={(e) => handleInputChange('notifyNewBookingEmail', e.target.checked)}
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3 mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">New Appointment Notifications</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Receive an email when someone books an appointment online or via your AI receptionist</p>
                    </div>
                  </label>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mt-4">
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
        )}
      </div>

      {/* Enable AI Receptionist Modal */}
      {showEnableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary dark:text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Enable AI Receptionist</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You&apos;re about to set up an AI phone receptionist for <strong>{formData.name}</strong>.
            </p>
            <ul className="space-y-2 mb-4">
              {[
                'A dedicated phone number will be created in your area code',
                'The AI answers calls 24/7 and handles questions about services, hours, and pricing',
                'Callers can book appointments directly over the phone',
                'Transfers to your personal number when someone asks for a real person',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-6">
              Once enabled, update your Google Business Profile with the new number — that&apos;s all you need to do.
            </p>
            {aiToggleMutation.isError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{aiToggleMutation.error?.message}</p>
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Disable AI Receptionist?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This will release your dedicated number{formData.vapiPhoneNumber ? <> <strong>{formData.vapiPhoneNumber}</strong></> : ''}.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Any customers who have this number saved will no longer reach your AI receptionist.
            </p>
            {aiToggleMutation.isError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{aiToggleMutation.error?.message}</p>
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

      {/* Crop Modal */}
      {cropModalOpen && imageToCrop && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-lg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Crop Logo</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Drag to reposition · Pinch or scroll to zoom</p>
              </div>
              <button
                onClick={() => { setCropModalOpen(false); setImageToCrop(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Crop Area */}
            <div className="relative w-full" style={{ height: 320 }}>
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid={false}
                style={{
                  containerStyle: { borderRadius: 0 },
                  cropAreaStyle: { border: '2px solid #8B5CF6', boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' },
                }}
              />
            </div>

            {/* Zoom Slider */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10h-6" />
              </svg>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => { setCropModalOpen(false); setImageToCrop(null); }}
                className="btn-outline text-sm px-4"
              >
                Cancel
              </button>
              <button
                onClick={handleCropApply}
                disabled={uploadingLogo}
                className="btn-primary text-sm px-5 disabled:opacity-60"
              >
                {uploadingLogo ? 'Applying…' : 'Crop & Use'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
