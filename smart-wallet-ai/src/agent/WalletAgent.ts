import { Connection } from '@solana/web3.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { TokenTransferTool, PriceCheckTool, BalanceCheckTool, SolTransferTool } from '../tools';
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SmartWalletConfig } from '../types';
import { SmartWallet } from '../wallet/SmartWallet';
import { BufferMemory } from "langchain/memory";
import { MessagesPlaceholder } from "@langchain/core/prompts";

export class WalletAgent {
  private model: BaseChatModel;
  private connection: Connection;
  private executor: AgentExecutor | null = null;
  private wallet: SmartWallet;
  private memory: BufferMemory;

  constructor(model: BaseChatModel, rpcUrl: string, config: SmartWalletConfig) {
    this.model = model;
    this.connection = new Connection(rpcUrl);
    this.wallet = new SmartWallet(config);
    this.memory = new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
      inputKey: "input",
      outputKey: "output",
    });
    this.initializeAgent();
  }

  private async initializeAgent() {
    const tools = [
      new TokenTransferTool(this.wallet),
      new SolTransferTool(this.wallet),
      new PriceCheckTool(this.wallet),
      new BalanceCheckTool(this.wallet),
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are an AI agent for a Solana Smart Wallet that helps users manage their digital assets.
      When connected to a user on smart wallet, you can use the tools provided to help user perform actions on their behalf.

      For ANY request that requires checking balances, transferring assets, or getting prices, you MUST use this format:

      Thought: (your reasoning about what needs to be done)
      Action: (the tool name to use)
      Action Input: (the exact JSON string required by the tool)
      Observation: (tool output)
      ... (repeat Thought/Action/Action Input/Observation if needed)
      Thought: I have completed the task
      Final Answer: (your final response to the user)

      Available Tools: {tool_names}

      Tool Descriptions:
      {tools}

      For general questions about capabilities or greetings, you MUST start your response with:
      Thought: This is a general question that doesn't require any tools
      Final Answer: (your detailed response)

      You MUST ONLY respond to commands that require these specific tools. For ANY other queries, respond:
      Thought: This query is not related to wallet operations
      Final Answer: I can only help with wallet operations like checking balances, making transfers, or checking prices. Please provide a specific wallet related query.


      IMPORTANT: EVERY response must start with "Thought:" and end with "Final Answer:".
      Never expose private keys or sensitive data.
      Always verify balances before transfers.
      Review chat history to avoid duplicate actions.
      And strictly deny any requests that don't involve managing digital assets or related tasks.
      If unsure, ask for clarification.`],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      ["assistant", "{agent_scratchpad}"]
    ]);

    try {
      const agent = await createReactAgent({
        llm: this.model,
        tools,
        prompt,
      });

      this.executor = new AgentExecutor({
        agent,
        tools,
        verbose: true,
        maxIterations: 5,
        returnIntermediateSteps: true,
        memory: this.memory
      });

    } catch (error) {
      console.error('Error initializing agent:', error);
      throw error;
    }
  }

  async processCommand(command: string): Promise<string> {
    if (!this.executor) {
      throw new Error('Agent not initialized');
    }

    const tools = this.executor.tools;
    const toolNames = tools.map(tool => tool.name).join(", ");
    const toolDescriptions = tools.map(tool => `${tool.name}: ${tool.description}`).join("\n");

    try {
      const result = await this.executor.invoke({
        input: command,
        tools: toolDescriptions,
        tool_names: toolNames
      });

      // Extract the Final Answer
      const finalAnswer = result.output.match(/Final Answer: (.*?)(?=\n|$)/s)?.[1];
      if (finalAnswer) {
        return finalAnswer.trim();
      }

      return result.output;
    } catch (error) {
      console.error('Error processing command:', error);
      
      if (error instanceof Error) {
        if (error.message.includes("Could not parse LLM output:")) {
          // Extract the response between the error message and the troubleshooting URL
          const errorParts = error.message.split("Could not parse LLM output:")[1].split("Troubleshooting URL:");
          if (errorParts.length > 0) {
            const response = errorParts[0].trim();
            // Check if this looks like a valid response
            if (response && !response.includes("Error:")) {
              return response;
            }
          }
        }
        return `Error: ${error.message}. Please try again with a clearer request.`;
      }
      
      return 'An unexpected error occurred while processing your request.';
    }
  }
}