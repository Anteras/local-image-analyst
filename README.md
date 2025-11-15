# Local Image Analyst

A small toy web application to upload an image and analyze it using a local, OpenAI-compatible Large Language Model. Users can define custom prompts to extract various types of information, including descriptive text, numerical scores, and bounding boxes for object detection, which are then visualized.

<img width="1664" height="1031" alt="oYpdmvF" src="https://github.com/user-attachments/assets/1423987a-4625-4f8d-8dff-eb5a1717da59" />

## Features

*   **Local LLM Integration**: Connects to any OpenAI-compatible API endpoint, perfect for running local vision models like LLaVA, Qwen-VL, or BakLLaVA via tools like Ollama or LM Studio.
*   **Multi-Image Workflow**: Upload multiple images and seamlessly switch between them. The gallery displays the analysis status (success, error, loading) for each image.
*   **Customizable Prompts**: Create, edit, reorder, and delete analysis prompts tailored to your specific needs.
*   **Versatile Result Types**:
    *   **Text**: For detailed descriptions or summaries.
    *   **Bounding Box**: To identify and locate objects within the image.
    *   **Score**: To rate aspects of the image on a configurable numerical scale.
    *   **Number**: To count objects or extract numerical data.
    *   **Yes/No**: For binary classification tasks.
    *   **Category**: To classify content against a predefined set of options.
    *   **JSON**: To extract structured data according to a specified schema.
*   **AI-Powered Prompt Generation**: Describe your analysis goal, and the application will use the LLM to generate a relevant set of starter prompts for you, with options to specify which types of prompts to create.
*   **Advanced Conditional Logic & Chaining**:
    *   **Per-Object Analysis**: Attach child prompts (e.g., Text, Score, Yes/No) to a Bounding Box prompt. The child prompts will automatically run for *each* object detected by the parent, allowing for detailed, per-object analysis.
    *   **Conditional Execution**: Trigger prompts based on the outcome of a parent prompt. Supports `Yes/No` (on 'yes' or 'no'), `Score` (e.g., run if score is above/below a value), and `Bounding Box` parents.
*   **Conversational Analysis**: Ask follow-up questions to any text-based result, creating a dynamic, chat-like interaction to refine your analysis.
*   **Targeted Analysis with Region Selection**: For text prompts, specify a point of interest or draw a bounding box directly on the image to focus the model's attention on a specific area.
*   **Interactive Viewer**: Visualize bounding box results and input regions directly on the image.
*   **Light & Dark Modes**: Switch between themes for your viewing comfort. Your preference is saved locally.
*   **Prompt Management**:
    *   Save entire sets of prompts to your browser's local storage.
    *   Load previously saved sets with a single click.
    *   Import and Export prompt sets as JSON files to share or back them up.
*   **Result Export**: Export analysis results for a single image as a `.txt`, `.md`, or a styled `.html` report.
*   **Developer Tools**: Includes an "API Inspector Mode" to easily copy the raw request and response JSON for debugging purposes, and advanced settings for `maxTokens` and `temperature`.

## Installation & Local Development

This is a standard Node.js application built with React and Vite.

### Prerequisites
*   Node.js (v18 or higher recommended)
*   npm or yarn

### Steps
1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/local-image-analyst.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd local-image-analyst
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Run the development server:
    ```bash
    npm run dev
    ```
5.  Open your browser and navigate to `http://localhost:5173` (or the URL provided in your terminal).

## Backend Setup: Local Vision LLM

To use this application, you must have a running local Large Language Model with vision capabilities that exposes an OpenAI-compatible API endpoint. Here are setup guides for a few popular options.

### Option 1: Ollama (Recommended)

[Ollama](https://ollama.com/) is a fantastic tool for running open-source LLMs locally.

1.  **Install Ollama**: Follow the instructions on their website.
2.  **Download a Vision Model**: Open your terminal and pull a model. For example, to get the LLaVA model:
    ```bash
    ollama pull llava
    ```
3.  **Run the Model**: Ollama automatically starts a server on `http://localhost:11434`. You don't need to run the model separately; the application's API calls will activate it.

### Option 2: LM Studio

1.  **Install LM Studio**: Download from the [official website](https://lmstudio.ai/).
2.  **Download a Vision Model**: Use the search tab within LM Studio to find and download a GGUF format vision model (e.g., search for `llava` or `qwen-vl`).
3.  **Start the Local Server**:
    *   Navigate to the "Local Server" tab (icon: `<->`).
    *   At the top, select the vision model you just downloaded.
    *   Click **Start Server**.
4.  **Note the URL**: The server will start, typically at `http://localhost:1234/v1`.

### Option 3: llama.cpp

This method is more advanced and requires compiling the software from source.
1.  **Install llama.cpp**: Follow the build instructions from the [official llama.cpp repository](https://github.com/ggerganov/llama.cpp).
2.  **Download Models**:
    *   You need a vision model in GGUF format (e.g., `llava-v1.5-7b-Q5_K.gguf`).
    *   You also need the corresponding multimodal projector file (e.g., `mmproj-llava-v1.5-7b-f16.gguf`).
3.  **Run the Server**: Open your terminal in the `llama.cpp` directory and run the server command.
    ```bash
    ./server -m /path/to/your/llava-model.gguf --mmproj /path/to/your/mmproj-file.gguf --port 8080
    ```
4.  **Note the URL**: The server will start, in this case at `http://localhost:8080/v1`.

## Getting Started (App Configuration)

### 1. Configure the API Endpoint

Once your local model is running, tell the application how to connect to it.

1.  Click the **Cog icon** (`⚙️`) in the top-right corner to open the API Settings.
2.  **API Endpoint URL**: Enter the chat completions URL for your backend.
    *   **Ollama**: `http://127.0.0.1:11434/v1/chat/completions`
    *   **LM Studio**: `http://127.0.0.1:1234/v1/chat/completions`
    *   **llama.cpp**: `http://127.0.0.1:8080/v1/chat/completions` (use the port you specified)
3.  **Model Name**: Enter the name of the model you are using.
    *   **Ollama**: The model tag, e.g., `llava:latest`.
    *   **LM Studio / llama.cpp**: The server uses the currently loaded model, so you can often use a placeholder like `local-model` or refer to the model file name.
4.  **Advanced Settings (Optional)**: You can also configure `Max Tokens`, `Temperature`, and enable `API Inspector Mode` for debugging.
5.  Click **Save Settings**.

### 2. Usage Workflow

1.  **Upload Images**: Drag and drop one or more images onto the designated area, or click to select them. You can also paste an image from your clipboard.
2.  **Select an Image**: The uploaded images appear in a gallery at the bottom. Click an image to select it for analysis.
3.  **Define Prompts**:
    *   Use the default prompts or modify them.
    *   Click "+ Add" to create a new prompt.
    *   Click "Auto" to have the AI generate prompts based on your goals.
    *   Click the map pin or viewfinder icon on a Text prompt to select a specific point or area on the image as input.
    *   Create child prompts under Bounding Box, Yes/No, or Score prompts to build powerful analysis workflows.
    *   Drag and drop prompts to reorder them.
4.  **Run Analysis**:
    *   Click **Analyze ... Pending** to run all prompts that haven't been completed for the selected image.
    *   Click **Analyze All Images** to run all prompts against every image in the gallery.
    *   Click the small **Play icon** on an individual prompt card to run only that prompt and its dependent children.
5.  **View Results**:
    *   Results will appear in cards on the right side of the screen as they complete.
    *   For bounding box results, click the **Eye icon** (`👁️`) to toggle their visibility on the image. Results from child prompts will be neatly nested under each detected object.
    *   For long text results, you can expand the content or view it in a maximized modal.
    *   Engage in a follow-up conversation with text results to ask for clarifications or more details.
6.  **Export**: Once you have results, click the **Export** button to save them as a text, markdown, or HTML file.

## Tech Stack

*   **Framework**: React
*   **Language**: TypeScript
*   **State Management**: Zustand
*   **Styling**: Tailwind CSS
*   **Build Tool**: Vite
