import { Redirect } from 'expo-router';

/**
 * Redirects the current route to the application's root path ("/").
 *
 * @returns A React element that performs a redirect to `/`.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}