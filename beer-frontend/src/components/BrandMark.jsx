export default function BrandMark({ className = 'h-10 w-10' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#FFF3D6" />
      <path
        d="M17.5 18.5C17.5 16.2909 19.2909 14.5 21.5 14.5H26.5C28.7091 14.5 30.5 16.2909 30.5 18.5V34.5C30.5 36.7091 28.7091 38.5 26.5 38.5H21.5C19.2909 38.5 17.5 36.7091 17.5 34.5V18.5Z"
        fill="#E86F00"
      />
      <path
        d="M20.5 11.5H27.5V15.5H20.5V11.5Z"
        fill="#B45309"
      />
      <path
        d="M19 9.5C19 8.67157 19.6716 8 20.5 8H27.5C28.3284 8 29 8.67157 29 9.5V11.5H19V9.5Z"
        fill="#F59E0B"
      />
      <path
        d="M20.5 22.5H27.5V33C27.5 34.1046 26.6046 35 25.5 35H22.5C21.3954 35 20.5 34.1046 20.5 33V22.5Z"
        fill="#FFF7ED"
        fillOpacity="0.88"
      />
      <path
        d="M15 20.25C10.75 21 8.5 23.65 8.5 27C8.5 30.3137 11.1863 33 14.5 33H17.5"
        stroke="#0F766E"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M33 15.25C37.25 16 39.5 18.65 39.5 22C39.5 25.3137 36.8137 28 33.5 28H30.5"
        stroke="#0F766E"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="27" r="2.5" fill="#14B8A6" />
      <circle cx="38" cy="22" r="2.5" fill="#14B8A6" />
      <circle cx="24" cy="29" r="2.5" fill="#F59E0B" />
      <path
        d="M22 24.5H26"
        stroke="#B45309"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
