import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

function RoyAvatar({ speaking = false }) {
  return <div className={`roy-avatar-stage${speaking ? " is-speaking" : ""}`} role="img" aria-label={speaking ? "Roy is speaking" : "Roy, AI interviewer"}>
    <div className="roy-avatar-halo" />
    <svg className="roy-avatar-art" viewBox="0 0 160 160" aria-hidden="true">
      <circle className="roy-avatar-disc" cx="80" cy="80" r="68" />
      <path className="roy-avatar-coat" d="M35 137c5-27 22-41 45-41s40 14 45 41v8H35z" />
      <path className="roy-avatar-shirt" d="m66 99 14 14 14-14 10 7-10 39H66l-10-39z" />
      <path className="roy-avatar-neck" d="M69 83h22v24H69z" />
      <ellipse className="roy-avatar-face" cx="80" cy="65" rx="29" ry="35" />
      <path className="roy-avatar-hair" d="M51 67c-5-29 9-47 31-47 23 0 34 16 28 42-8-4-14-12-16-20-10 11-26 17-43 17z" />
      <path className="roy-avatar-brow" d="M62 63h12m12 0h12" />
      <circle className="roy-avatar-eye" cx="68" cy="68" r="2.2" /><circle className="roy-avatar-eye" cx="92" cy="68" r="2.2" />
      <path className="roy-avatar-nose" d="m79 69-3 11h7" />
      <path className="roy-avatar-mouth" d="M71 86q9 5 18 0" />
      <path className="roy-avatar-collar" d="m66 99 14 14 14-14" />
    </svg>
    <span className="roy-avatar-caption" aria-live="polite">{speaking ? "Roy is speaking" : "Roy · AI interviewer"}</span>
  </div>;
}

export default function CandidateVoiceInterview({ initial, interviewToken, onFinish }) {
  const [session, setSession] = useState(initial);
  const [answer, setAnswer] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [roySpeaking, setRoySpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const mediaRecorder = useRef(null);
  const mediaStream = useRef(null);
  const audioChunks = useRef([]);
  const recordingTimer = useRef(null);
  const shouldTranscribe = useRef(false);
  const question = session.question_plan?.[session.current_index];

  useEffect(() => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return undefined;
    const updateVoices = () => setAvailableVoices(synthesis.getVoices());
    updateVoices();
    synthesis.addEventListener?.("voiceschanged", updateVoices);
    return () => synthesis.removeEventListener?.("voiceschanged", updateVoices);
  }, []);

  function speak(text, onEnd) {
    if (!window.speechSynthesis || !text) { setRoySpeaking(false); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const language = session.interview_language || "en-US";
    utterance.lang = language;
    utterance.rate = 0.94;
    utterance.pitch = 1.08;
    utterance.volume = 1;
    const languagePrefix = language.split("-")[0].toLowerCase();
    const matchingVoices = availableVoices.filter((voice) => voice.lang?.toLowerCase().startsWith(languagePrefix));
    const royVoice = matchingVoices.find((voice) => /female|jenny|aria|ava|samantha|serena|libby|zira|susan|michelle|sara|emma|olivia|clara|victoria|karen/i.test(voice.name));
    const naturalVoice = matchingVoices.find((voice) => /natural|neural/i.test(voice.name));
    const exactLanguageVoice = matchingVoices.find((voice) => voice.lang?.toLowerCase() === language.toLowerCase());
    utterance.voice = royVoice || naturalVoice || exactLanguageVoice || matchingVoices.find((voice) => voice.default) || matchingVoices[0] || null;
    setRoySpeaking(true);
    utterance.onend = () => {
      setRoySpeaking(false);
      onEnd?.();
    };
    utterance.onerror = () => setRoySpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => () => {
    shouldTranscribe.current = false;
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    window.clearTimeout(recordingTimer.current);
    window.speechSynthesis?.cancel();
  }, []);

  function begin() {
    speak("Hello, I'm Roy, your interviewer. I'll ask you questions about your background and the role. You can answer naturally and take your time. Let's begin.", () => {
      speak(question?.prompt);
    });
  }

  async function startAudioRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("This browser cannot record audio here. Use HTTPS or localhost, or type your answer.");
      return;
    }
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream.current = stream;
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunks.current = [];
      shouldTranscribe.current = true;
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunks.current.push(event.data); };
      recorder.onerror = () => setError("Audio recording failed. Check microphone access or type your answer.");
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStream.current = null;
        setRecording(false);
        if (!shouldTranscribe.current) return;
        shouldTranscribe.current = false;
        const blob = new Blob(audioChunks.current, { type: recorder.mimeType || "audio/webm" });
        audioChunks.current = [];
        if (!blob.size) { setError("No audio was captured. Check the microphone and try again."); return; }
        setTranscribing(true);
        setError("");
        try {
          const result = await api.transcribePublicInterview(interviewToken, blob);
          const transcript = result.transcript.trim();
          if (!transcript) {
            setError("No speech was detected. Please record again or type your answer.");
            return;
          }
          setAnswer((current) => current.trim() ? `${current.trim()}\n${transcript}` : transcript);
          setError("Recording transcribed. Review and edit your answer below before submitting.");
        } catch (err) { setError(err.message); }
        finally { setTranscribing(false); }
      };
      mediaRecorder.current = recorder;
      recorder.start(250);
      setRecording(true);
      recordingTimer.current = window.setTimeout(() => {
        if (recorder.state === "recording") {
          shouldTranscribe.current = true;
          recorder.stop();
          setError("Recording stopped after 90 seconds. Transcribing your answer…");
        }
      }, 90000);
    } catch (err) {
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
      const message = err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
        ? "Microphone access was blocked. Allow microphone access for this site in your browser settings, then try again."
        : err.name === "NotFoundError"
          ? "No microphone was found. Connect or enable a microphone, then try again."
          : `Could not start microphone capture (${err.name || "browser error"}). Try typing your answer.`;
      setError(message);
      setRecording(false);
    }
  }

  function stopAudioRecording() {
    window.clearTimeout(recordingTimer.current);
    if (mediaRecorder.current?.state === "recording") {
      shouldTranscribe.current = true;
      mediaRecorder.current.stop();
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    setSaving(true);
    setError("");
    stopAudioRecording();
    try {
      const updated = await api.answerPublicInterview(interviewToken, answer.trim());
      setSession(updated);
      setAnswer("");
      if (updated.complete) speak(updated.closing);
      else speak(updated.next_question?.prompt);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (session.status === "completed") return <section className="card candidate-interview interview-complete">
    <RoyAvatar speaking={roySpeaking} /><span className="eyebrow">Interview complete</span>
    <h2>Thank you for your time.</h2>
    <p>{session.closing || `You have completed the AI interview for the ${session.job_title} position. Your responses will be reviewed by the HR team.`}</p>
    <p className="helper-text">Your assessment and interview are submitted. The HR team will communicate next steps.</p>
    <button className="btn btn-primary" type="button" onClick={onFinish}>Finish</button>
  </section>;

  return <section className="card candidate-interview">
    <div className="page-header">
      <div className="roy-heading"><RoyAvatar speaking={roySpeaking} /><div><span className="eyebrow">AI interview · {session.interview_duration} min</span><h2>{session.job_title}</h2></div></div>
    </div>
    <p className="helper-text">Your assessment was submitted successfully. Your interview responses will be saved with this application and reviewed by the HR team.</p>
    {error && <div className="error-banner">{error}</div>}
    {!agreed ? <>
      <h3>{session.welcome || "Hello, I'm Roy, your interviewer. I'll ask you questions about your background and the role. You can answer naturally and take your time. Let's begin."}</h3>
      <p className="helper-text">Allow microphone access when asked. You can record your answer for transcription or type it in the answer box.</p>
      <button className="btn btn-primary" type="button" onClick={() => { setAgreed(true); begin(); }}>Yes, begin interview</button>
    </> : <>
      <div className="helper-text interview-progress">Question {session.current_index + 1} of {session.question_plan.length}</div>
      <h3 className="interview-question">{question?.prompt}</h3>
      <div className="chat-input-row">
        {recording ? <button className="btn btn-primary" type="button" onClick={stopAudioRecording}>Stop recording</button> : <button className="btn btn-primary" type="button" onClick={startAudioRecording} disabled={transcribing}>{transcribing ? "Transcribing audio…" : "Record answer"}</button>}
        <button className="btn btn-ghost" type="button" onClick={begin}>Repeat question</button>
      </div>
      <p className="helper-text">The audio fallback sends the short clip to the configured Gemini service for transcription; HRMS does not keep the audio file.</p>
      {recording && <p className="helper-text" aria-live="polite">Recording… stop when you have finished your answer. Maximum 90 seconds.</p>}
      <div className="field"><label htmlFor="candidate-interview-answer">Your answer</label>
        <p className="helper-text">After recording, the transcript appears here. You can edit it before submitting.</p>
        <textarea id="candidate-interview-answer" rows={6} maxLength={20000} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Speak or type your response here" />
      </div>
      <button className="btn btn-primary" type="button" disabled={saving || recording || transcribing || !answer.trim()} onClick={submitAnswer}>
        {saving ? "Saving answer…" : session.current_index + 1 === session.question_plan.length ? "Submit final answer" : "Submit answer and continue"}
      </button>
    </>}
  </section>;
}
