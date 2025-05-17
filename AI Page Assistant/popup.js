
document.getElementById("askBtn").addEventListener("click", async () => {
  const question = document.getElementById("question").value;
  const responseDiv = document.getElementById("response");
  responseDiv.textContent = "Thinking...";

  chrome.storage.local.get("pageText", async (data) => {
    const pageText = data.pageText || "";
    const userInput = `${question}\n\nBased on the page content:\n${pageText}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer ENTER_YOUR_API_KEY"
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [{ role: "user", content: userInput }],
        temperature: 0.7
      })
    });

    const result = await res.json();
    const aiReply = result.choices?.[0]?.message?.content || "No response";
    responseDiv.textContent = aiReply;
  });
});
document.getElementById("askBtn").addEventListener("click", async () => {
  const question = document.getElementById("question").value;
  const responseDiv = document.getElementById("response");
  responseDiv.textContent = "Thinking...";

  chrome.storage.local.get("pageText", async (data) => {
    const pageText = data.pageText || "";
    const userInput = `You are an AI assistant helping a user understand a webpage.
    ONLY use the page content below to answer the question. Do not guess or add outside knowledge.
    PAGE CONTENT:
    ${pageText}
    QUESTION:
    ${question}`;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer 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"
        },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          messages: [{ role: "user", content: userInput }],
          temperature: 0.7
        })
      });

      const result = await res.json();
      console.log("Groq API Response:", result); // DEBUG INFO

      if (result.choices && result.choices.length > 0) {
        responseDiv.textContent = result.choices[0].message.content;
      } else {
        responseDiv.textContent = "AI replied with no choices.";
      }
    } catch (error) {
      console.error("Error calling Groq API:", error);
      responseDiv.textContent = "Failed to get response. Check the console (DevTools).";
    }
  });
});
