import { useApp } from '../context/AppContext';

export function FloatingWhatsAppButton() {
  const { catalog } = useApp();
  const settings = catalog?.settings;

  if (settings?.showFloatingWhatsapp === false) {
    return null;
  }

  const rawPhone = settings?.supportWhatsapp || settings?.adminNotifyPhone || '+2347031537390';
  const digits = rawPhone.replace(/[^\d]/g, '') || '2347031537390';
  const displayPhone = rawPhone.trim() || '+2347031537390';
  const siteName = settings?.siteName || 'SureDeal Store';

  return (
    <a
      href={`https://wa.me/${digits}?text=${encodeURIComponent(`Hello ${siteName} Support, I need help.`)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat on WhatsApp Support (${displayPhone})`}
      title={`WhatsApp Support (${displayPhone})`}
      className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-30 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#25D366] hover:bg-[#1EB856] text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/50"
    >
      <svg
        viewBox="0 0 32 32"
        className="w-6 h-6 sm:w-7 sm:h-7 fill-current"
        aria-hidden="true"
      >
        <path d="M16.004 2.667C8.64 2.667 2.667 8.64 2.667 16c0 2.353.614 4.648 1.78 6.673L2.55 29.6l7.092-1.858A13.27 13.27 0 0 0 16.004 29.333C23.367 29.333 29.333 23.36 29.333 16S23.367 2.667 16.004 2.667zm0 24.307c-2.063 0-4.085-.555-5.847-1.605l-.42-.249-4.208 1.103 1.124-4.101-.273-.435A10.918 10.918 0 0 1 5.027 16c0-6.053 4.925-10.977 10.977-10.977 6.051 0 10.973 4.924 10.973 10.977 0 6.052-4.922 10.974-10.973 10.974zm6.02-8.221c-.33-.165-1.953-.964-2.256-1.074-.302-.11-.522-.165-.742.165-.22.33-.852 1.074-1.044 1.294-.193.22-.385.248-.715.083-.33-.165-1.394-.514-2.655-1.638-.982-.875-1.644-1.957-1.837-2.287-.192-.33-.02-.509.145-.673.149-.148.33-.385.495-.578.165-.193.22-.33.33-.55.11-.22.055-.413-.028-.578-.082-.165-.742-1.79-1.017-2.45-.268-.644-.54-.557-.742-.567l-.632-.011c-.22 0-.578.083-.88.413-.303.33-1.155 1.129-1.155 2.754s1.182 3.195 1.347 3.415c.165.22 2.327 3.553 5.637 4.983.788.34 1.402.543 1.882.695.791.251 1.51.216 2.078.131.634-.095 1.953-.799 2.228-1.57.275-.771.275-1.432.193-1.57-.083-.138-.303-.22-.633-.385z" />
      </svg>
    </a>
  );
}
