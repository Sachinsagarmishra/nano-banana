// Nano Banana Pro - Figma Plugin Backend
// API key is hardcoded here — never exposed to the UI

const API_KEY = "72ca6ff81a2fb81444f16ebcf5b4dd41";
const API_BASE = "https://api.kie.ai/api/v1";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 120; // 6 minutes max

// ─── Show UI ───
figma.showUI(__html__, {
    width: 420,
    height: 680,
    themeColors: true,
    title: "Nano Banana Pro"
});

// ─── Handle messages from UI ───
figma.ui.onmessage = async (msg: { type: string;[key: string]: any }) => {

    // ─── Export selected element as reference image ───
    if (msg.type === "export-selection") {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            figma.ui.postMessage({ type: "selection-error", message: "No element selected. Please select an element on the canvas." });
            return;
        }

        try {
            const node = selection[0];
            const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 2 } });

            figma.ui.postMessage({
                type: "selection-exported",
                data: bytes,
                name: node.name,
                width: ('width' in node) ? (node as any).width : 100,
                height: ('height' in node) ? (node as any).height : 100
            });
        } catch (error: any) {
            figma.ui.postMessage({ type: "selection-error", message: "Failed to export selection: " + (error.message || error) });
        }
    }

    // ─── Get current selection info ───
    if (msg.type === "get-selection-info") {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            figma.ui.postMessage({ type: "selection-info", hasSelection: false });
        } else {
            const node = selection[0];
            figma.ui.postMessage({
                type: "selection-info",
                hasSelection: true,
                name: node.name,
                nodeType: node.type,
                id: node.id
            });
        }
    }

    // ─── Generate Image ───
    // imageInput now contains real HTTP URLs (uploaded by the UI before sending here)
    if (msg.type === "generate-image") {
        const { prompt, imageInput, aspectRatio, resolution, outputFormat } = msg;

        try {
            // Create Task
            figma.ui.postMessage({ type: "generation-status", status: "creating", message: "Creating generation task..." });

            const createRes = await fetch(`${API_BASE}/jobs/createTask`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: "nano-banana-pro",
                    input: {
                        prompt: prompt,
                        image_input: imageInput || [],
                        aspect_ratio: aspectRatio || "1:1",
                        resolution: resolution || "1K",
                        output_format: outputFormat || "png"
                    }
                })
            });

            const createText = await createRes.text();
            const createData = JSON.parse(createText);

            if (createData.code !== 200) {
                figma.ui.postMessage({ type: "generation-error", message: createData.msg || `API Error: ${createData.code}` });
                return;
            }

            const taskId = createData.data.taskId;
            figma.ui.postMessage({ type: "generation-status", status: "polling", message: "Task created! Generating image...", taskId: taskId });

            // Poll for results
            let attempts = 0;
            const poll = async () => {
                attempts++;
                if (attempts > MAX_POLL_ATTEMPTS) {
                    figma.ui.postMessage({ type: "generation-error", message: "Task timed out after 6 minutes." });
                    return;
                }

                try {
                    const pollRes = await fetch(`${API_BASE}/jobs/recordInfo?taskId=${taskId}`, {
                        headers: { "Authorization": `Bearer ${API_KEY}` }
                    });

                    const pollText = await pollRes.text();
                    const pollData = JSON.parse(pollText);

                    if (pollData.code !== 200) {
                        figma.ui.postMessage({ type: "generation-status", status: "polling", message: `Query error: ${pollData.msg}`, elapsed: attempts * (POLL_INTERVAL_MS / 1000) });
                        setTimeout(poll, POLL_INTERVAL_MS);
                        return;
                    }

                    const taskState = pollData.data.state;

                    if (taskState === "success") {
                        const resultJson = JSON.parse(pollData.data.resultJson);
                        const resultUrls = resultJson.resultUrls || [];

                        if (resultUrls.length === 0) {
                            figma.ui.postMessage({ type: "generation-error", message: "No image was generated." });
                            return;
                        }

                        const costTime = pollData.data.costTime ? `${(pollData.data.costTime / 1000).toFixed(1)}s` : `${(attempts * POLL_INTERVAL_MS / 1000).toFixed(0)}s`;
                        figma.ui.postMessage({
                            type: "generation-complete",
                            imageUrl: resultUrls[0],
                            costTime: costTime
                        });

                    } else if (taskState === "fail") {
                        figma.ui.postMessage({ type: "generation-error", message: pollData.data.failMsg || "Task failed." });
                    } else {
                        figma.ui.postMessage({ type: "generation-status", status: "polling", message: "Generating image...", elapsed: attempts * (POLL_INTERVAL_MS / 1000) });
                        setTimeout(poll, POLL_INTERVAL_MS);
                    }
                } catch (err: any) {
                    figma.ui.postMessage({ type: "generation-status", status: "polling", message: "Connection error, retrying...", elapsed: attempts * (POLL_INTERVAL_MS / 1000) });
                    setTimeout(poll, POLL_INTERVAL_MS);
                }
            };

            setTimeout(poll, POLL_INTERVAL_MS);

        } catch (error: any) {
            figma.ui.postMessage({ type: "generation-error", message: error.message || String(error) });
        }
    }

    // ─── Place generated image on canvas ───
    if (msg.type === "place-image") {
        try {
            const { imageUrl, width, height } = msg;
            const image = await figma.createImageAsync(imageUrl);
            const selection = figma.currentPage.selection;

            if (selection.length > 0) {
                // If something is selected, try to fill it
                const node = selection[0];
                if ("fills" in node) {
                    const newFills = Array.isArray(node.fills) ? [...node.fills] : [];
                    newFills.push({
                        type: "IMAGE",
                        scaleMode: "FILL",
                        imageHash: image.hash
                    });
                    node.fills = newFills;
                    figma.notify("✅ Image added to selection!");
                } else {
                    // Fallback: Create new
                    createNewImageNode(image, width, height);
                }
            } else {
                createNewImageNode(image, width, height);
            }

            figma.ui.postMessage({ type: "image-placed", success: true });
        } catch (error: any) {
            figma.ui.postMessage({ type: "image-placed", success: false, error: error.message || String(error) });
            figma.notify("❌ Failed to place image: " + (error.message || error), { timeout: 5000, error: true });
        }
    }

    function createNewImageNode(image: Image, width?: number, height?: number) {
        const rect = figma.createRectangle();
        const imgWidth = width || 1024;
        const imgHeight = height || 1024;
        rect.resize(imgWidth, imgHeight);

        const viewport = figma.viewport.center;
        rect.x = viewport.x - imgWidth / 2;
        rect.y = viewport.y - imgHeight / 2;

        rect.fills = [{
            type: "IMAGE",
            scaleMode: "FILL",
            imageHash: image.hash
        }];

        rect.name = "Generated Image - Nano Banana Pro";
        figma.currentPage.appendChild(rect);
        figma.currentPage.selection = [rect];
        figma.viewport.scrollAndZoomIntoView([rect]);
    }

    // ─── Resize UI ───
    if (msg.type === "resize") {
        figma.ui.resize(msg.width, msg.height);
    }

    // ─── Close plugin ───
    if (msg.type === "close") {
        figma.closePlugin();
    }
};

// Listen for selection changes
figma.on("selectionchange", () => {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        figma.ui.postMessage({ type: "selection-info", hasSelection: false });
    } else {
        const node = selection[0];
        figma.ui.postMessage({
            type: "selection-info",
            hasSelection: true,
            name: node.name,
            nodeType: node.type,
            id: node.id
        });
    }
});
