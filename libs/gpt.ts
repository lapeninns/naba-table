import axios from 'axios';

import { env } from '@/lib/env';

// Use this if you want to make a call to OpenAI GPT-4 for instance. userId is used to identify the user on openAI side.
export const sendOpenAi = async (
  messages: any[], // TODO: type this
  userId: number,
  max = 100,
  temp = 1
) => {
  const url = 'https://api.openai.com/v1/chat/completions';

  console.log('Ask GPT >>>');
  messages.map((m) =>
    console.log(' - ' + m.role.toUpperCase() + ': ' + m.content)
  );

  const body = JSON.stringify({
    model: 'gpt-4',
    messages,
    max_tokens: max,
    temperature: temp,
    user: userId,
  });

  const apiKey = env.misc.openAiKey;

  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY.');
  }

  const options = {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  try {
    const res = await axios.post(url, body, options);

    const answer = res.data.choices[0].message.content;
    const usage = res?.data?.usage;

    console.log('>>> ' + answer);
    console.log(
      'TOKENS USED: ' +
        usage?.total_tokens +
        ' (prompt: ' +
        usage?.prompt_tokens +
        ' / response: ' +
        usage?.completion_tokens +
        ')'
    );
    console.log('\n');

    return answer;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('GPT Error:', error.response?.status, error.response?.data);
    } else {
      console.error('GPT Error:', error);
    }
    return null;
  }
};
