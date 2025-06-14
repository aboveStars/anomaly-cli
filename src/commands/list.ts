import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { AuthUser } from "../auth/index";

export interface FileInfo {
  name: string;
  isDirectory: boolean;
  size?: number;
  modified?: Date;
}

export async function listDirectoryContents(user: AuthUser): Promise<void> {
  try {
    console.log(chalk.blue.bold(`\n📁 Directory Contents for ${user.email}\n`));

    // Get current working directory
    const currentDir = process.cwd();
    console.log(chalk.gray(`📍 Current directory: ${currentDir}\n`));

    // Read directory contents
    const items = await fs.readdir(currentDir);

    if (items.length === 0) {
      console.log(chalk.yellow("📂 This directory is empty\n"));
      return;
    }

    const fileInfos: FileInfo[] = [];

    // Get detailed info for each item
    for (const item of items) {
      try {
        const itemPath = path.join(currentDir, item);
        const stats = await fs.stat(itemPath);

        fileInfos.push({
          name: item,
          isDirectory: stats.isDirectory(),
          size: stats.isFile() ? stats.size : undefined,
          modified: stats.mtime,
        });
      } catch (error) {
        // Skip items we can't access
        fileInfos.push({
          name: item,
          isDirectory: false,
        });
      }
    }

    // Sort: directories first, then files, alphabetically
    fileInfos.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    // Display the contents
    fileInfos.forEach((item) => {
      const icon = item.isDirectory ? "📁" : "📄";
      const name = item.isDirectory
        ? chalk.blue.bold(item.name)
        : chalk.white(item.name);

      let details = "";
      if (item.size !== undefined) {
        details += chalk.gray(` (${formatFileSize(item.size)})`);
      }
      if (item.modified) {
        details += chalk.gray(` - ${item.modified.toLocaleDateString()}`);
      }

      console.log(`${icon} ${name}${details}`);
    });

    console.log(
      chalk.gray(
        `\n📊 Total: ${fileInfos.length} items (${
          fileInfos.filter((f) => f.isDirectory).length
        } directories, ${
          fileInfos.filter((f) => !f.isDirectory).length
        } files)\n`
      )
    );
  } catch (error: any) {
    console.error(
      chalk.red(`❌ Error listing directory contents: ${error.message}`)
    );
  }
}

function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
