// Date utility functions

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('ja-JP');
};

export const formatDateTime = (date: Date): string => {
  return date.toLocaleString('ja-JP');
};

export const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};
