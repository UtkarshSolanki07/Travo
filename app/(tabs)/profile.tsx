import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { Text, View, StyleSheet } from 'react-native'
import { SignOutButton } from '@/components/SignOutButton'

export default function ProfileScreen() {
  const { user } = useUser()

  return (
    <View style={styles.container}>
      <SignedIn>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.email}>{user?.emailAddresses[0].emailAddress}</Text>
        <View style={styles.buttonContainer}>
          <SignOutButton />
        </View>
      </SignedIn>
      <SignedOut>
        <Text style={styles.title}>You are not signed in</Text>
        <View style={styles.authLinks}>
          <Link href="/sign-in" style={styles.link}>
            <Text style={styles.linkText}>Sign in</Text>
          </Link>
          <Link href="/sign-up" style={styles.link}>
            <Text style={styles.linkText}>Sign up</Text>
          </Link>
        </View>
      </SignedOut>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  buttonContainer: {
    padding: 10,
    backgroundColor: '#ff4444',
    borderRadius: 8,
  },
  authLinks: {
    marginTop: 20,
    width: '100%',
    gap: 15,
  },
  link: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    textAlign: 'center',
  },
  linkText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
