import {exec} from "child_process";
import * as core from "@actions/core";


export function executeCommand(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                if (stderr) core.error(stderr);
                core.error(`Command failed:\n${stdout}`);
                reject(err);
                return;
            }

            if (stderr) core.debug(`Command stderr: ${stderr}`);
            core.debug(`Command output: ${stdout}`);

            resolve(stdout);
        });
    });
}
