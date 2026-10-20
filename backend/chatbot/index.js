import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { HumanMessage } from "@langchain/core/messages";
import { chatbotApp } from "./graph.js";

async function runTerminalChatbot() {
  const rl = readline.createInterface({ input, output });

  // Session ID used by checkpointer to isolate conversation history
  let threadId = `session-${Date.now()}`;
  let config = { configurable: { thread_id: threadId } };

  console.log(`\nChatbot started [Thread: ${threadId}]`);
  console.log(`Commands: exit, /clear, /history\n`);

  try {
    while (true) {
      const userInput = await rl.question("\x1b[36mYou:\x1b[0m ");
      const trimmed = userInput.trim();

      if (!trimmed) continue;

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "/exit") {
        console.log("\nBye!\n");
        break;
      }

      if (trimmed.toLowerCase() === "/clear") {
        threadId = `session-${Date.now()}`;
        config = { configurable: { thread_id: threadId } };
        console.log(`\nMemory reset. New thread: ${threadId}\n`);
        continue;
      }

      if (trimmed.toLowerCase() === "/history") {
        const state = await chatbotApp.getState(config);
        const history = state?.values?.messages || [];
        console.log("\n--- Message History ---");
        if (!history.length) {
          console.log("(empty)");
        } else {
          history.forEach((msg, idx) => {
            const role = msg._getType ? msg._getType() : msg.role || "unknown";
            const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
            console.log(`[${idx + 1}] ${role.toUpperCase()}: ${content.slice(0, 120)}`);
          });
        }
        console.log("------------------------\n");
        continue;
      }

      process.stdout.write("\x1b[33mThinking...\x1b[0m\r");

      try {
        const response = await chatbotApp.invoke(
          { messages: [new HumanMessage(trimmed)] },
          config
        );

        process.stdout.write("              \r");

        const messages = response.messages;
        const lastMessage = messages[messages.length - 1];

        // Display tool execution feedback if Tavily was called during the turn
        const toolMessages = messages.filter((m) => m._getType?.() === "tool");
        if (toolMessages.length > 0) {
          const lastTool = toolMessages[toolMessages.length - 1];
          console.log(`\x1b[90m[Tavily Search: ${lastTool.name || "search"}]\x1b[0m`);
        }

        console.log(`\x1b[32mBot:\x1b[0m ${lastMessage.content}\n`);
      } catch (err) {
        process.stdout.write("              \r");
        console.error("\x1b[31mError:\x1b[0m", err.message || err, "\n");
      }
    }
  } finally {
    rl.close();
  }
}

runTerminalChatbot().catch(console.error);
