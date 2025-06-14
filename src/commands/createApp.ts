import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import prompts from "prompts";
import ora from "ora";
import archiver from "archiver";
import { AuthUser } from "../auth/index";
import { getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { app } from "../firebase/clientApp";

// You can replace this with your actual backend endpoint
const BACKEND_ENDPOINT =
  "https://anomaly-git-app-apidon.vercel.app/api/createApp"; // Replace with your actual endpoint

export async function createApp(user: AuthUser): Promise<void> {
  try {
    console.log(chalk.blue.bold(`\n🚀 Create New App for ${user.email}\n`));

    // Step 1: Get app name from user
    const appNameResponse = await prompts({
      type: "text",
      name: "appName",
      message: "What would you like to name your app?",
      validate: (value: string) =>
        value.length < 3
          ? "App name must be at least 3 characters long"
          : value.length > 50
          ? "App name must be less than 50 characters"
          : true,
    });

    if (!appNameResponse.appName) {
      console.log(chalk.yellow("\n👋 Operation cancelled!"));
      return;
    }

    const appName = appNameResponse.appName.trim();
    console.log(chalk.green(`\n✅ App name: ${chalk.bold(appName)}`));

    // Step 2: Get current directory and create zip
    const currentDir = process.cwd();
    const projectName = path.basename(currentDir);
    const zipFileName = `${projectName}-${Date.now()}.zip`;
    const tempZipPath = path.join(currentDir, zipFileName);

    console.log(
      chalk.cyan(`\n🗂️  Preparing to zip project: ${chalk.bold(projectName)}`)
    );
    console.log(chalk.gray(`📍 Current directory: ${currentDir}`));

    const zipSpinner = ora(
      "📦 Creating zip file (excluding node_modules)..."
    ).start();

    try {
      await createZipFile(currentDir, tempZipPath);
      zipSpinner.succeed(chalk.green("📦 Zip file created successfully!"));
    } catch (error) {
      zipSpinner.fail(chalk.red("❌ Failed to create zip file"));
      throw error;
    }

    // Step 3: Upload to Firebase Storage
    console.log(chalk.cyan("\n☁️  Uploading to Firebase Storage..."));

    try {
      const uploadedFileName = await uploadToFirebase(
        tempZipPath,
        zipFileName,
        user
      );
      console.log(
        chalk.green(
          `✅ File uploaded successfully: ${chalk.bold(uploadedFileName)}`
        )
      );

      // Step 4: Send request to backend
      console.log(chalk.cyan("\n🌐 Creating app in backend..."));
      const appId = await createAppInBackend(uploadedFileName, appName, user);

      console.log(chalk.green.bold("\n🎉 App created successfully!"));
      console.log(chalk.gray(`   App Name: ${appName}`));
      console.log(chalk.gray(`   App ID: ${appId}`));
      console.log(chalk.gray(`   Source File: ${uploadedFileName}`));

      // Display dashboard URL
      const dashboardUrl = `https://anomaly-git-app-apidon.vercel.app/dashboard/${appId}`;
      console.log(chalk.blue.bold(`\n🔗 Dashboard URL:`));
      console.log(chalk.cyan(`   ${dashboardUrl}`));
      console.log(
        chalk.gray(
          `\n💡 You can now visit your app dashboard at the URL above.`
        )
      );
    } finally {
      // Clean up temporary zip file
      try {
        await fs.unlink(tempZipPath);
        console.log(chalk.gray("\n🧹 Cleaned up temporary files"));
      } catch (cleanupError) {
        console.log(
          chalk.yellow("⚠️  Warning: Could not clean up temporary zip file")
        );
      }
    }

    console.log(chalk.blue.bold("\n✨ All done! Your app is ready to go!\n"));
  } catch (error: any) {
    if (error.name === "ExitPromptError") {
      console.log(chalk.yellow("\n👋 Operation cancelled!"));
      return;
    }
    console.error(chalk.red(`\n❌ Error creating app: ${error.message}`));
    throw error;
  }
}

async function createZipFile(
  sourceDir: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = require("fs").createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on("close", () => {
      const sizeInMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
      console.log(chalk.gray(`   📊 Archive size: ${sizeInMB} MB`));
      resolve();
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add all files except node_modules and other common excludes
    archive.glob("**/*", {
      cwd: sourceDir,
      ignore: ["node_modules/**", ".git/**"],
    });

    archive.finalize();
  });
}

async function uploadToFirebase(
  filePath: string,
  fileName: string,
  user: AuthUser
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const storagePath = `source_files/${user.uid}/${fileName}`;
      const storageRef = ref(getStorage(app), storagePath);

      const metadata = {
        contentType: "application/zip",
      };

      const uploadTask = uploadBytesResumable(storageRef, fileBuffer, metadata);

      let progressSpinner: any;

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const progressText = `☁️  Uploading... ${Math.round(progress)}%`;

          if (!progressSpinner) {
            progressSpinner = ora(progressText).start();
          } else {
            progressSpinner.text = progressText;
          }
        },
        (error) => {
          if (progressSpinner) progressSpinner.fail();
          reject(error);
        },
        () => {
          if (progressSpinner) {
            progressSpinner.succeed(chalk.green("☁️  Upload completed!"));
          }
          resolve(fileName);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

async function createAppInBackend(
  fileName: string,
  appName: string,
  user: AuthUser
): Promise<string> {
  const backendSpinner = ora("🌐 Sending request to backend...").start();

  try {
    // Get the auth token
    const authToken = await user.user.getIdToken();

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(BACKEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: fileName,
        appName: appName,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      backendSpinner.succeed(chalk.green("🌐 Backend request successful!"));

      // Parse the response to get the appId
      const responseData = await response.json();
      const appId = responseData.appId;

      if (!appId) {
        throw new Error("Server response missing appId");
      }

      return appId;
    } else {
      // Try to get error message from response
      let errorMessage = response.statusText;
      try {
        const errorData = await response.text();
        errorMessage = errorData;
      } catch {
        // If JSON parsing fails, use statusText
      }
      throw new Error(
        `Backend returned status ${response.status} - ${errorMessage}`
      );
    }
  } catch (error: any) {
    backendSpinner.fail(chalk.red("❌ Backend request failed"));

    if (error.name === "AbortError") {
      throw new Error("Request timeout - please check your connection");
    } else if (error.message.includes("fetch")) {
      throw new Error(
        "No response from backend - please check your connection"
      );
    } else {
      throw new Error(`Request error: ${error.message}`);
    }
  }
}
