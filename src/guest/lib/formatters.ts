export const getGreeting = (now: Date = new Date()): string => {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
};

export const getGreetingEmoji = (now: Date = new Date()): string => {
  const hour = now.getHours();
  if (hour < 12) return "☀️";
  if (hour < 17) return "👋";
  if (hour < 21) return "🌆";
  return "🌙";
};
