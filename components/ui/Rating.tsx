interface RatingProps {
  value: number;
  size?: "xs" | "sm" | "default" | "lg";
  color?: string;
}

export const Rating = ({ 
  value, 
  size = "default",
  color
}: RatingProps) => {
  const fullStars = Math.floor(value);
  const hasHalfStar = value % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  // Determine star size based on size prop
  const starSize = size === "xs" ? 16 : 
                  size === "sm" ? 20 : 
                  size === "lg" ? 28 : 
                  24;
                   
  // Use the provided color or default to CSS variable for star color - using Elfsight's gold
  const starColor = color || 'var(--star-color, #FFC107)';
  
  // Create star SVG components for more reliable rendering - using Elfsight style
  const StarIcon = ({ filled = true }: { filled?: boolean }) => (
    <svg 
      width={starSize} 
      height={starSize} 
      viewBox="0 0 24 24" 
      fill={filled ? starColor : 'none'} 
      stroke={filled ? 'none' : starColor}
      strokeWidth="1"
      className="mr-0.5"
      style={{ 
        filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.2)) ${filled ? 'brightness(1.05)' : ''}`,
      }}
    >
      <path 
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
        fill={filled ? starColor : 'none'} 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
  
  // Half-star component with improved styling
  const HalfStarIcon = () => (
    <svg 
      width={starSize} 
      height={starSize} 
      viewBox="0 0 24 24" 
      fill="url(#halfStarGradient)"
      stroke="none"
      className="mr-0.5"
      style={{ 
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.2)) brightness(1.05)",
      }}
    >
      <defs>
        <linearGradient id="halfStarGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="50%" stopColor={starColor} />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
        <clipPath id="halfStarClip">
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>
      <path 
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
        stroke={starColor}
        strokeWidth="1"
        fill="transparent"
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
        clipPath="url(#halfStarClip)"
        fill={starColor} 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="flex items-center transition-theme">
      {[...Array(fullStars)].map((_, i) => (
        <StarIcon key={`full-${i}`} />
      ))}
      {hasHalfStar && <HalfStarIcon />}
      {[...Array(emptyStars)].map((_, i) => (
        <StarIcon key={`empty-${i}`} filled={false} />
      ))}
    </div>
  );
};

export default Rating;