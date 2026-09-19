import { useThemeStore } from "../store/useThemeStore";

// Theme-aware Pulse app mark: white artwork on dark UI schemes,
// black artwork on light UI schemes (a white mark is invisible on light).
const PulseLogo = ({ className = "", alt = "Pulse Logo" }) => {
  const { theme } = useThemeStore();
  return (
    <img
      src={theme === "light" ? "/logo-dark.png" : "/logo.png"}
      alt={alt}
      className={`${className} logo-squircle`}
    />
  );
};

export default PulseLogo;
