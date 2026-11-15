// The Gemini answers the reviewer tests and the UI harness (--fake-ai) send back: a full reviewer, and a
// targeted batch for weak topics. The right option is written first; the server shuffles them.

const q = (topic, prompt, options, explanation, difficulty = 'medium') => ({ topic, prompt, options, correctIndex: 0, explanation, difficulty });
// What a good Gemini answer for the handout looks like. The right option is written first.
export const REVIEWER = {
    title: 'Stress and Coping Basics',
    summary: 'How stress works in the body and mind, and the main ways to cope with it.',
    topics: [
        { name: 'Stress and appraisal', summary: 'Eustress, distress and how appraisal shapes stress.' },
        { name: 'The stress response', summary: 'Fight-or-flight, the HPA axis and cortisol.' },
        { name: 'Coping strategies', summary: 'Problem-focused and emotion-focused coping.' },
    ],
    keyPoints: ['Appraisal decides whether a situation is stressful.', 'Cortisol stays high during long stress.'],
    keyTerms: [{ term: 'Eustress', definition: 'Positive stress that motivates.' }],
    questions: [
        q('Stress and appraisal', 'What is eustress?', ['Positive stress that motivates', 'Stress that causes illness', 'A stress hormone', 'A coping style'], 'Eustress is positive stress.', 'easy'),
        q('Stress and appraisal', 'What happens in secondary appraisal?', ['Judging if you can cope', 'Judging if a situation is stressful', 'Releasing cortisol', 'Seeking support'], 'Secondary appraisal is about resources.'),
        q('Stress and appraisal', 'Who proposed the transactional model?', ['Lazarus and Folkman', 'Hans Selye', 'Cohen and Kamarck', 'Freud'], 'Lazarus and Folkman, 1984.', 'easy'),
        q('The stress response', 'Which gland releases ACTH?', ['Pituitary', 'Adrenal cortex', 'Hypothalamus', 'Thyroid'], 'The pituitary releases ACTH.'),
        q('The stress response', 'What does the adrenal cortex release?', ['Cortisol', 'Adrenaline', 'CRH', 'Insulin'], 'The adrenal cortex releases cortisol.'),
        q('The stress response', 'What is the last stage of the General Adaptation Syndrome?', ['Exhaustion', 'Alarm', 'Resistance', 'Recovery'], 'Exhaustion comes last.', 'hard'),
        q('Coping strategies', 'Making a study schedule is an example of what?', ['Problem-focused coping', 'Emotion-focused coping', 'Avoidance', 'Eustress'], 'It changes the situation itself.'),
        q('Coping strategies', 'When does emotion-focused coping work best?', ['When the stressor cannot be changed', 'When the stressor can be controlled', 'Never', 'Only at night'], 'It fits stressors you cannot change.', 'hard'),
        q('Coping strategies', 'What does kapwa refer to?', ['Shared identity', 'Fate', 'A stress hormone', 'A test'], 'Kapwa is a shared identity.', 'easy'),
        q('Coping strategies', 'Which is emotion-focused coping?', ['Deep breathing', 'Splitting a project into tasks', 'Asking a teacher for help', 'Making a schedule'], 'Deep breathing changes how you feel.'),
    ],
};
export const TARGETED = {
    questions: [
        q('The stress response', 'What does the hypothalamus release first in the HPA axis?', ['CRH', 'ACTH', 'Cortisol', 'Adrenaline'], 'The hypothalamus starts with CRH.'),
        q('The stress response', 'Which part of the adrenal gland releases adrenaline?', ['Adrenal medulla', 'Adrenal cortex', 'Pituitary', 'Thalamus'], 'The medulla releases adrenaline.'),
        q('The stress response', 'What can cortisol that stays high for weeks do?', ['Weaken the immune system', 'Cure insomnia', 'Lower blood sugar', 'Stop the heart'], 'Long high cortisol weakens immunity.', 'hard'),
        q('The stress response', 'Which system starts fight-or-flight?', ['Sympathetic nervous system', 'Parasympathetic nervous system', 'Digestive system', 'Lymphatic system'], 'The sympathetic system triggers it.', 'easy'),
        q('The stress response', 'Which stage of the GAS comes first?', ['Alarm', 'Resistance', 'Exhaustion', 'Adaptation'], 'Alarm is the first stage.', 'easy'),
    ],
};
export const isTargetedPrompt = (prompt) => prompt.includes('new multiple-choice questions on these topics only');
