import { hashPassword } from "../src/server/password";
async function main() {
  if (!process.stdin.isTTY)
    throw new Error("Run this command in an interactive terminal.");
  process.stdout.write("New owner password (12–256 characters; hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  const password = await new Promise<string>((resolve, reject) => {
    let value = "";
    const listener = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish();
          reject(new Error("Cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b")
          value = value.slice(0, -1);
        else if (character >= " " && value.length < 257) value += character;
      }
    };
    function finish() {
      process.stdin.off("data", listener);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    process.stdin.on("data", listener);
  });
  console.log(`\nADMIN_PASSWORD_HASH='${await hashPassword(password)}'`);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
