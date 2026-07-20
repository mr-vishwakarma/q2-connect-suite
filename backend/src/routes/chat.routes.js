const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');

// @desc    Chat endpoint (replaces Supabase edge function)
// @route   POST /api/chat
// @access  Private
// Note: This is a simple AI chat passthrough. Extend with your preferred AI provider (OpenAI, Gemini, etc.)
router.post('/', protect, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }

    // Placeholder response — integrate your AI provider here
    // Example with OpenAI:
    // const openai = require('openai');
    // const response = await openai.chat.completions.create({ ... });

    const reply = `You said: "${message}". (AI integration pending — add your AI provider key)`;

    return res.status(200).json({
      success: true,
      reply,
      role: 'assistant',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
