import { exec } from "child_process";
import type { IClipboard } from "../../../application/common/IClipboard.js";

export class PowerShellClipboard implements IClipboard {
  read(): Promise<string> {
    return new Promise((resolve) => {
      exec(
        'powershell.exe -noprofile -command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Clipboard"',
        { encoding: "utf8" },
        (err, stdout) => resolve(err ? "" : stdout.replace(/\r?\n$/, "")),
      );
    });
  }
}

