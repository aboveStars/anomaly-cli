import { auth } from "../firebase/clientApp";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  user: User;
}

export class AuthManager {
  private currentUser: User | null = null;

  constructor() {
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
    });
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        if (user) {
          resolve({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            user: user,
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const spinner = ora("Signing in...").start();
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      spinner.succeed(chalk.green("Successfully signed in!"));
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        user: userCredential.user,
      };
    } catch (error: any) {
      spinner.fail(chalk.red("Sign in failed"));
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  async signUp(email: string, password: string): Promise<AuthUser> {
    const spinner = ora("Creating account...").start();
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      spinner.succeed(chalk.green("Account created successfully!"));
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        user: userCredential.user,
      };
    } catch (error: any) {
      spinner.fail(chalk.red("Account creation failed"));
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  }

  async signOut(): Promise<void> {
    const spinner = ora("Signing out...").start();
    try {
      await signOut(auth);
      spinner.succeed(chalk.green("Successfully signed out!"));
    } catch (error) {
      spinner.fail(chalk.red("Sign out failed"));
      throw error;
    }
  }

  private getAuthErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case "auth/user-not-found":
        return "No account found with this email address.";
      case "auth/wrong-password":
        return "Incorrect password.";
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/invalid-email":
        return "Invalid email address.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later.";
      default:
        return "Authentication failed. Please try again.";
    }
  }

  async promptAuthentication(): Promise<AuthUser> {
    console.log(chalk.blue.bold("\n🔐 Authentication Required\n"));

    const { action } = await prompts({
      type: "select",
      name: "action",
      message: "Choose an option:",
      choices: [
        { title: "🔑 Sign In", value: "signin" },
        { title: "📝 Create Account", value: "signup" },
        { title: "❌ Exit", value: "exit" },
      ],
      initial: 0,
    });

    if (action === "exit") {
      console.log(chalk.yellow("\n👋 Goodbye!"));
      process.exit(0);
    }

    const credentials = await this.promptCredentials();

    try {
      if (action === "signin") {
        return await this.signIn(credentials.email, credentials.password);
      } else {
        return await this.signUp(credentials.email, credentials.password);
      }
    } catch (error: any) {
      console.log(chalk.red(`\n❌ ${error.message}\n`));

      const { retry } = await prompts({
        type: "confirm",
        name: "retry",
        message: "Would you like to try again?",
        initial: true,
      });

      if (retry) {
        return this.promptAuthentication();
      } else {
        console.log(chalk.yellow("\n👋 Goodbye!"));
        process.exit(0);
      }
    }
  }

  private async promptCredentials(): Promise<{
    email: string;
    password: string;
  }> {
    const { email } = await prompts({
      type: "text",
      name: "email",
      message: "Email address:",
      validate: (value: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) || "Please enter a valid email address";
      },
    });

    if (!email) {
      console.log(chalk.yellow("\n👋 Goodbye!"));
      process.exit(0);
    }

    const { password } = await prompts({
      type: "password",
      name: "password",
      message: "Password:",
      validate: (value: string) => {
        return value.length >= 6 || "Password must be at least 6 characters";
      },
    });

    if (!password) {
      console.log(chalk.yellow("\n👋 Goodbye!"));
      process.exit(0);
    }

    return { email, password };
  }
}

export const authManager = new AuthManager();
