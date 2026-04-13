import toast from 'react-hot-toast';

/**
 * Sanitizes and displays errors to the user.
 * In production, we avoid showing raw database errors.
 */
export function handleError(error: any, context?: string) {
  console.error(`Error [${context || 'General'}]:`, error);

  let message = 'An unexpected error occurred. Please try again.';

  if (typeof error === 'string') {
    message = error;
  } else if (error?.message) {
    // Handle specific Supabase error codes if needed
    if (error.code === '23505') {
      message = 'This record already exists.';
    } else if (error.code === '42501') {
      message = 'You do not have permission to perform this action.';
    } else if (error.message.includes('infinite recursion')) {
      message = 'A security configuration error occurred. Please contact support.';
    } else if (error.message.includes('JWT')) {
      message = 'Your session has expired. Please sign in again.';
    } else {
      // For other errors, we might want to show the message in dev but a generic one in prod
      const isDev = import.meta.env.DEV;
      message = isDev ? error.message : 'Something went wrong while processing your request.';
    }
  }

  toast.error(message);
  return message;
}
