import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import prompts from "prompts";
import ora from "ora";
import archiver from "archiver";
import { AuthUser } from "../auth/index";
import { getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { app } from "../firebase/clientApp";

const BACKEND_ENDPOINT = "https://anomaly-git-app-apidon.vercel.app/api/createApp";

export async function createApp(user: AuthUser): Promise<void> {
  try {
    console.log(
      chalk.blue.bold(
        `\n🚀 Initializing new app creation for ${chalk.cyan(user.email)}\n`
      )
    );

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
      console.log(chalk.yellow("\n👋 App creation cancelled by user"));
      return;
    }

    const appName = appNameResponse.appName.trim();
    console.log(
      chalk.green(`\n✅ App name confirmed: ${chalk.bold.white(appName)}`)
    );

    // Step 2: Get current directory and create zip
    const currentDir = process.cwd();
    const projectName = path.basename(currentDir);
    const zipFileName = `${projectName}-${Date.now()}.zip`;
    const tempZipPath = path.join(currentDir, zipFileName);

    console.log(chalk.cyan(`\n📁 Preparing project archive for deployment`));
    console.log(chalk.gray(`   └─ Project: ${chalk.white(projectName)}`));
    console.log(chalk.gray(`   └─ Source: ${currentDir}`));

    const zipSpinner = ora(
      "📦 Creating project archive (excluding node_modules and .git)..."
    ).start();

    try {
      await createZipFile(currentDir, tempZipPath);
      zipSpinner.succeed(
        chalk.green("📦 Project archive created successfully")
      );
    } catch (error) {
      zipSpinner.fail(chalk.red("❌ Failed to create project archive"));
      throw error;
    }

    // Step 3: Upload to Firebase Storage
    console.log(
      chalk.cyan("\n☁️  Uploading project archive to cloud storage...")
    );

    try {
      const uploadedFileName = await uploadToFirebase(
        tempZipPath,
        zipFileName,
        user
      );
      console.log(chalk.green(`✅ Upload completed successfully`));
      console.log(
        chalk.gray(`   └─ Cloud file: ${chalk.white(uploadedFileName)}`)
      );

      // Step 4: Send request to backend
      console.log(
        chalk.cyan("\n🔧 Requesting app deployment from backend service...")
      );
      const appId = await createAppInBackend(uploadedFileName, appName, user);

      console.log(chalk.green.bold("\n🎉 Application deployed successfully!"));
      console.log(chalk.gray(`   └─ App Name: ${chalk.white(appName)}`));
      console.log(chalk.gray(`   └─ App ID: ${chalk.white(appId)}`));
      console.log(
        chalk.gray(`   └─ Source Archive: ${chalk.white(uploadedFileName)}`)
      );

      // Display dashboard URL
      const dashboardUrl = `https://anomaly-git-app-apidon.vercel.app/dashboard/${appId}`;
      console.log(chalk.blue.bold(`\n🌐 Your app dashboard is ready:`));
      console.log(chalk.cyan.underline(`   ${dashboardUrl}`));
      console.log(
        chalk.gray(
          `\n💡 Visit the dashboard URL above to manage your application`
        )
      );
    } finally {
      // Clean up temporary zip file
      try {
        await fs.unlink(tempZipPath);
        console.log(chalk.gray("🧹 Temporary files cleaned up"));
      } catch (cleanupError) {
        console.log(
          chalk.yellow("⚠️  Warning: Could not remove temporary archive file")
        );
      }
    }

    console.log(
      chalk.green.bold("\n✨ App creation completed successfully! 🚀\n")
    );
  } catch (error: any) {
    if (error.name === "ExitPromptError") {
      console.log(chalk.yellow("\n👋 App creation cancelled by user"));
      return;
    }
    console.error(chalk.red(`\n❌ App creation failed: ${error.message}`));
    console.error(chalk.gray("💡 Please check your connection and try again"));
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

    const projectName = path.basename(sourceDir);
    const zipFileName = path.basename(outputPath);

    archive.glob(
      "**/*",
      {
        cwd: sourceDir,
        ignore: ["node_modules/**", ".git/**", "dist/**", zipFileName],
        dot: true,
      },
      {
        prefix: `${projectName}/`,
      }
    );

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
  const backendSpinner = ora(
    "🔧 Communicating with deployment service..."
  ).start();

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
      backendSpinner.succeed(
        chalk.green("🔧 Deployment service responded successfully")
      );

      // Parse the response to get the appId
      const responseData = await response.json();
      const appId = responseData.appId;

      if (!appId) {
        throw new Error("Deployment service did not return a valid app ID");
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
        `Deployment service error (${response.status}): ${errorMessage}`
      );
    }
  } catch (error: any) {
    backendSpinner.fail(chalk.red("❌ Deployment service request failed"));

    if (error.name === "AbortError") {
      throw new Error(
        "Request timed out after 30 seconds - please check your internet connection"
      );
    } else if (error.message.includes("fetch")) {
      throw new Error(
        "Unable to reach deployment service - please verify your internet connection"
      );
    } else {
      throw new Error(`Deployment request failed: ${error.message}`);
    }
  }
}
