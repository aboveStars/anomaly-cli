#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { authManager, AuthUser } from "./auth/index.js";

import { createApp } from "./commands/createApp.js";

const program = new Command();

program.name("anomaly-cli").description("Anomaly CLI").version("0.0.1");

// Global variable to store current user
let currentUser: AuthUser | null = null;

// Authentication middleware
async function requireAuth(): Promise<AuthUser> {
  console.log(chalk.cyan.bold("\n🚀 Welcome to Anomaly CLI!\n"));

  // Check if user is already authenticated
  currentUser = await authManager.getCurrentUser();

  if (currentUser) {
    console.log(chalk.green(`✅ Welcome back, ${currentUser.email}!\n`));
    return currentUser;
  }

  // If not authenticated, prompt for authentication
  console.log(chalk.yellow("🔒 You need to sign in to use this CLI.\n"));
  currentUser = await authManager.promptAuthentication();
  console.log(chalk.green(`\n🎉 Welcome, ${currentUser.email}!\n`));

  return currentUser;
}
// Auth command
program
  .command("auth")
  .description("Authentication commands")
  .addCommand(
    new Command("status")
      .description("Check authentication status")
      .action(async () => {
        const user = await authManager.getCurrentUser();
        if (user) {
          console.log(chalk.green(`✅ Signed in as: ${user.email}`));
          console.log(chalk.gray(`   User ID: ${user.uid}`));
        } else {
          console.log(chalk.red("❌ Not signed in"));
        }
      })
  )
  .addCommand(
    new Command("login")
      .description("Sign in to your account")
      .action(async () => {
        try {
          const user = await authManager.promptAuthentication();
          currentUser = user;
          console.log(chalk.green(`\n🎉 Welcome, ${user.email}!\n`));
        } catch (error) {
          console.log(chalk.red("Authentication failed"));
        }
      })
  )
  .addCommand(
    new Command("logout")
      .description("Sign out of your account")
      .action(async () => {
        try {
          await authManager.signOut();
          currentUser = null;
          console.log(
            chalk.green("\n👋 You have been signed out successfully!\n")
          );
        } catch (error: any) {
          console.log(chalk.red(`Error signing out: ${error.message}`));
        }
      })
  );

program
  .command("init")
  .description("Initialize and secure your app with anomaly protection")
  .action(async () => {
    const user = await requireAuth();
    await createApp(user);
  });

// Add a public command that doesn't require authentication
program
  .command("info")
  .description("Show CLI information")
  .action(() => {
    console.log(chalk.blue.bold("\n📋 Anomaly CLI Information\n"));
    console.log(`Version: ${chalk.cyan("0.0.1")}`);
    console.log(
      `Description: ${chalk.gray(
        "A powerful CLI tool with Firebase authentication"
      )}`
    );
    console.log(`\nTo get started:`);
    console.log(`  • Run ${chalk.cyan("anomaly auth login")} to sign in`);
    console.log(`  • Run ${chalk.cyan("anomaly init")} to secure your app`);
    console.log(
      `  • Run ${chalk.cyan("anomaly --help")} to see all commands\n`
    );
  });

// Handle errors gracefully
process.on("uncaughtException", (error) => {
  if (error.name === "ExitPromptError") {
    console.log(chalk.yellow("\n👋 Until next time!"));
    process.exit(0);
  } else {
    console.error(chalk.red("An unexpected error occurred:"), error.message);
    process.exit(1);
  }
});

program.parse(process.argv);
