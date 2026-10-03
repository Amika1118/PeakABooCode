/* ============================================
   call-test.js - pre-call camera / mic / speaker check
   - User-priority permissions: explain, then ask
   - Live camera preview
   - Mic level meter via Web Audio API
   - Speaker test tone
   - Device pickers (camera, mic, speaker)
   - Optional 3-second record/playback (audio-only, local)
   - Stop releases all tracks
   - Auto-suspend when the browser tab or site tab changes
   - Resume prompt when the user comes back
   - Open on phone via QR (reuses CodeGenerator)
   ============================================ */
(function () {
    'use strict';

    var el = {};
    var stream = null;
    var audioCtx = null;
    var analyser = null;
    var meterRAF = null;
    var toneNodes = null;
    var mediaRecorder = null;
    var recordedChunks = [];
    var recordedBlobUrl = null;
    var currentSinkId = '';
    var recordingConsentGiven = false;

    // Suspension: true when we stopped devices due to a tab change
    var suspended = false;

    // ---- Init ----
    function init() {
        el.panel = document.querySelector('[data-tab-panel="test"]');
        if (!el.panel) return;

        el.stage = el.panel.querySelector('[data-test-stage]');
        el.status = el.panel.querySelector('[data-test-status]');
        if (!el.stage) return;

        renderIdle();
        wireTabSuspension();
    }

    // ---- Tab suspension ----
    function wireTabSuspension() {
        // Browser tab visibility
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') {
                if (stream) suspendTest();
            } else if (document.visibilityState === 'visible') {
                if (suspended && currentSiteTab() === 'test') {
                    // Small delay so the browser finishes the focus switch
                    setTimeout(maybeShowResume, 150);
                }
            }
        });

        // Site tab changes (hash routing)
        window.addEventListener('hashchange', function () {
            var tab = currentSiteTab();
            if (tab !== 'test' && stream) {
                suspendTest();
            } else if (tab === 'test' && suspended) {
                setTimeout(maybeShowResume, 200);
            }
        });

        // Also catch when the user closes / navigates away
        window.addEventListener('pagehide', function () {
            if (stream) suspendTest();
        });
    }

    function currentSiteTab() {
        var raw = (window.location.hash || '#clean').replace(/^#/, '').split('/')[0];
        return raw || 'clean';
    }

    function suspendTest() {
        if (!stream) return;
        console.log('[CallTest] Suspending — tab changed. Releasing devices.');
        suspended = true;

        stopRecordingIfAny();
        deleteRecording();
        stopTone();
        stopMeter();

        if (stream) {
            try {
                stream.getTracks().forEach(function (t) { t.stop(); });
            } catch (e) { /* ignore */ }
            stream = null;
        }
        if (audioCtx && audioCtx.state !== 'closed') {
            try { audioCtx.close(); } catch (e) { /* ignore */ }
        }
        audioCtx = null;
        analyser = null;

        // Clear any previous resume prompt
        var existing = el.stage && el.stage.querySelector('[data-resume-prompt]');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

        setStatus('');
        renderIdle();
    }

    function maybeShowResume() {
        if (!suspended) return;
        // Don't stack multiple prompts
        if (el.stage.querySelector('[data-resume-prompt]')) return;
        showResumePrompt();
    }

    function showResumePrompt() {
        var div = document.createElement('div');
        div.className = 'calltest-resume';
        div.setAttribute('data-resume-prompt', '');
        div.setAttribute('role', 'alert');
        div.innerHTML =
            '<div class="calltest-resume-icon" aria-hidden="true">🔒</div>' +
            '<div class="calltest-resume-text">' +
            '<h3 class="calltest-resume-title">We turned off your camera and mic</h3>' +
            '<p class="calltest-resume-body">' +
            'For privacy, we stopped your devices when you left. ' +
            'Want to test again or quit?' +
            '</p>' +
            '</div>' +
            '<div class="calltest-resume-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-resume-yes>Test again</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-resume-no>Quit</button>' +
            '</div>';

        el.stage.insertBefore(div, el.stage.firstChild);

        wire(div.querySelector('[data-resume-yes]'), 'click', function () {
            div.parentNode.removeChild(div);
            suspended = false;
            startTest();
        });

        wire(div.querySelector('[data-resume-no]'), 'click', function () {
            div.parentNode.removeChild(div);
            suspended = false;
        });
    }

    // ---- Render states ----
    function renderIdle() {
        el.stage.innerHTML =
            '<div class="calltest-intro">' +
            '<div class="calltest-intro-icon" aria-hidden="true">🎥</div>' +
            '<h2 class="calltest-intro-title">Ready to check?</h2>' +
            '<p class="calltest-intro-text">' +
            'We\'ll use your camera and microphone <strong>only for this test</strong>. ' +
            'Nothing is recorded, saved, or uploaded. You can stop at any time.' +
            '</p>' +
            '<div class="calltest-intro-actions">' +
            '<button type="button" class="btn btn-primary" data-test-start>Start test</button>' +
            '<button type="button" class="btn btn-secondary" data-test-phone>Open on phone via QR</button>' +
            '</div>' +
            '<ul class="calltest-intro-points">' +
            '<li>✓ See yourself on camera</li>' +
            '<li>✓ Check your mic level moves when you speak</li>' +
            '<li>✓ Hear a test tone through your speaker</li>' +
            '</ul>' +
            '</div>';

        wire(el.stage.querySelector('[data-test-start]'), 'click', startTest);
        wire(el.stage.querySelector('[data-test-phone]'), 'click', showPhoneQr);
    }

    function renderRunning() {
        el.stage.innerHTML =
            '<div class="calltest">' +
            '<div class="calltest-video-wrap">' +
            '<video data-test-video autoplay playsinline muted></video>' +
            '<div class="calltest-video-overlay" data-test-overlay hidden>' +
            '<span class="spinner spinner-lg"></span>' +
            '<span>Starting devices...</span>' +
            '</div>' +
            '</div>' +

            '<div class="calltest-panel">' +
            '<div class="calltest-block">' +
            '<label class="calltest-label">Microphone level</label>' +
            '<div class="calltest-meter" aria-hidden="true">' +
            '<span class="calltest-meter-fill" data-test-meter></span>' +
            '</div>' +
            '<p class="calltest-hint">Speak. The bar should move.</p>' +
            '</div>' +

            '<div class="calltest-block">' +
            '<label class="calltest-label">Speaker</label>' +
            '<div class="calltest-actions-inline">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-test-tone>Play test tone</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-test-stop-tone hidden>Stop tone</button>' +
            '</div>' +
            '<p class="calltest-hint">Listen for a short beep.</p>' +
            '</div>' +

            '<div class="calltest-block">' +
            '<label class="calltest-label">Record a 3-second clip (optional)</label>' +
            '<div class="calltest-actions-inline">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-test-record>Record 3s</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-test-playback hidden>Play</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-test-delete hidden>Delete</button>' +
            '</div>' +
            '<p class="calltest-hint">Stays in your browser. Never uploaded.</p>' +
            '<div class="calltest-audio-holder" data-test-audio-holder></div>' +
            '</div>' +

            '<div class="calltest-block">' +
            '<label class="calltest-label">Devices</label>' +
            '<div class="calltest-devices">' +
            '<select class="calltest-select" data-test-cam aria-label="Camera"></select>' +
            '<select class="calltest-select" data-test-mic aria-label="Microphone"></select>' +
            '<select class="calltest-select" data-test-spk aria-label="Speaker" hidden></select>' +
            '</div>' +
            '</div>' +

            '<div class="calltest-stop-row">' +
            '<button type="button" class="btn btn-danger" data-test-stop>Stop and release</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        wire(el.stage.querySelector('[data-test-stop]'), 'click', onManualStop);
        wire(el.stage.querySelector('[data-test-tone]'), 'click', playTone);
        wire(el.stage.querySelector('[data-test-stop-tone]'), 'click', stopTone);
        wire(el.stage.querySelector('[data-test-record]'), 'click', onRecordClick);
        wire(el.stage.querySelector('[data-test-playback]'), 'click', playRecording);
        wire(el.stage.querySelector('[data-test-delete]'), 'click', deleteRecording);

        var camSel = el.stage.querySelector('[data-test-cam]');
        var micSel = el.stage.querySelector('[data-test-mic]');
        var spkSel = el.stage.querySelector('[data-test-spk]');
        if (camSel) camSel.addEventListener('change', function () { switchCamera(camSel.value); });
        if (micSel) micSel.addEventListener('change', function () { switchMic(micSel.value); });
        if (spkSel) spkSel.addEventListener('change', function () { switchSpeaker(spkSel.value); });
    }

    // ---- Start / stop ----
    function startTest() {
        suspended = false;
        renderRunning();

        var videoEl = el.stage.querySelector('[data-test-video]');
        var overlay = el.stage.querySelector('[data-test-overlay]');
        if (overlay) overlay.hidden = false;

        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(function (s) {
                stream = s;
                if (videoEl) videoEl.srcObject = s;
                if (overlay) overlay.hidden = true;

                startMeter(s);
                refreshDevices();
                setStatus('Devices are live. Press "Stop and release" when done.');
                console.log('[CallTest] Stream ready. Tracks:', s.getTracks().map(function (t) {
                    return t.kind + ':' + (t.label || '(unlabeled)');
                }).join(', '));
            })
            .catch(function (err) {
                handlePermissionError(err);
            });
    }

    // Manual Stop button handler — user explicitly ended the test
    function onManualStop() {
        suspended = false;
        stopTest();
    }

    function stopTest() {
        stopRecordingIfAny();
        deleteRecording();
        stopTone();
        stopMeter();

        if (stream) {
            try {
                stream.getTracks().forEach(function (t) { t.stop(); });
            } catch (e) { /* ignore */ }
            stream = null;
        }

        if (audioCtx && audioCtx.state !== 'closed') {
            try { audioCtx.close(); } catch (e) { /* ignore */ }
        }
        audioCtx = null;
        analyser = null;

        setStatus('');
        renderIdle();
    }

    function handlePermissionError(err) {
        var msg;
        if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
            msg = 'Camera and mic access was denied. Allow them in your browser settings, then try again.';
            try { document.dispatchEvent(new CustomEvent('bot:denied-camera')); } catch (e) { }
        } else if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
            msg = 'No camera or microphone found on this device.';
        } else if (err && err.name === 'NotReadableError') {
            msg = 'Another app is using your camera or mic. Close it and try again.';
        } else {
            msg = err && err.message ? err.message : 'Could not access your devices.';
        }
        setStatus(msg, 'error');
        renderIdle();
    }

    // ---- Mic meter ----
    function startMeter(s) {
        if (!s.getAudioTracks().length) return;
        try {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            audioCtx = new Ctx();
            var source = audioCtx.createMediaStreamSource(s);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.75;
            source.connect(analyser);
            tick();
        } catch (e) {
            console.warn('[CallTest] Meter error:', e);
        }
    }

    function tick() {
        if (!analyser) return;
        var buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);

        var max = 0;
        for (var i = 0; i < buf.length; i++) {
            if (buf[i] > max) max = buf[i];
        }

        var fill = el.stage.querySelector('[data-test-meter]');
        if (fill) {
            var pct = Math.min(100, Math.round((max / 255) * 100 * 1.6));
            fill.style.width = pct + '%';
            fill.setAttribute('data-level', pct > 60 ? 'high' : pct > 20 ? 'mid' : 'low');
        }

        meterRAF = requestAnimationFrame(tick);
    }

    function stopMeter() {
        if (meterRAF) {
            cancelAnimationFrame(meterRAF);
            meterRAF = null;
        }
    }

    // ---- Devices ----
    function refreshDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        navigator.mediaDevices.enumerateDevices().then(function (list) {
            var cams = [], mics = [], spks = [];
            list.forEach(function (d) {
                if (d.kind === 'videoinput') cams.push(d);
                else if (d.kind === 'audioinput') mics.push(d);
                else if (d.kind === 'audiooutput') spks.push(d);
            });

            populateSelect(el.stage.querySelector('[data-test-cam]'), cams, 'Camera');
            populateSelect(el.stage.querySelector('[data-test-mic]'), mics, 'Microphone');

            var spkSel = el.stage.querySelector('[data-test-spk]');
            var supportsSink = typeof HTMLMediaElement !== 'undefined' &&
                'setSinkId' in HTMLMediaElement.prototype;
            if (spkSel && spks.length && supportsSink) {
                spkSel.hidden = false;
                populateSelect(spkSel, spks, 'Speaker');
            } else if (spkSel) {
                spkSel.hidden = true;
            }
        }).catch(function () { /* ignore */ });
    }

    function populateSelect(sel, devices, defaultLabel) {
        if (!sel) return;
        var prev = sel.value;
        sel.innerHTML = '';
        if (!devices.length) {
            var opt = document.createElement('option');
            opt.textContent = 'No ' + defaultLabel.toLowerCase() + ' found';
            opt.disabled = true;
            opt.selected = true;
            sel.appendChild(opt);
            return;
        }
        devices.forEach(function (d, i) {
            var opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || (defaultLabel + ' ' + (i + 1));
            sel.appendChild(opt);
        });
        if (prev) sel.value = prev;
        else sel.selectedIndex = 0;
    }

    function switchCamera(deviceId) {
        if (!stream) return;
        navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
            audio: false
        }).then(function (newStream) {
            var newVideo = newStream.getVideoTracks()[0];
            var oldVideo = stream.getVideoTracks()[0];
            if (oldVideo) {
                stream.removeTrack(oldVideo);
                oldVideo.stop();
            }
            stream.addTrack(newVideo);

            var videoEl = el.stage.querySelector('[data-test-video]');
            if (videoEl) videoEl.srcObject = stream;
        }).catch(function (e) { console.warn('[CallTest] Camera switch:', e); });
    }

    function switchMic(deviceId) {
        if (!stream) return;
        navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } },
            video: false
        }).then(function (newStream) {
            var newAudio = newStream.getAudioTracks()[0];
            var oldAudio = stream.getAudioTracks()[0];
            if (oldAudio) {
                stream.removeTrack(oldAudio);
                oldAudio.stop();
            }
            stream.addTrack(newAudio);

            stopMeter();
            if (audioCtx && audioCtx.state !== 'closed') {
                try { audioCtx.close(); } catch (e) { /* ignore */ }
            }
            startMeter(stream);
        }).catch(function (e) { console.warn('[CallTest] Mic switch:', e); });
    }

    function switchSpeaker(deviceId) {
        currentSinkId = deviceId;
        var videoEl = el.stage.querySelector('[data-test-video]');
        if (videoEl && typeof videoEl.setSinkId === 'function') {
            try { videoEl.setSinkId(deviceId); } catch (e) { /* ignore */ }
        }
    }

    // ---- Speaker test tone ----
    function playTone() {
        if (!audioCtx || audioCtx.state === 'closed') {
            try {
                var Ctx = window.AudioContext || window.webkitAudioContext;
                audioCtx = new Ctx();
            } catch (e) {
                setStatus('Could not play a test tone in this browser.', 'error');
                return;
            }
        }
        stopTone();

        try {
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 440;
            gain.gain.value = 0.08;
            osc.connect(gain).connect(audioCtx.destination);
            osc.start();
            toneNodes = { osc: osc, gain: gain };

            toggleToneButtons(true);
            setStatus('Playing a short test tone...');
            setTimeout(stopTone, 1200);
        } catch (e) {
            setStatus('Could not play a test tone.', 'error');
        }
    }

    function stopTone() {
        if (toneNodes && toneNodes.osc) {
            try { toneNodes.osc.stop(); } catch (e) { /* ignore */ }
            try { toneNodes.osc.disconnect(); } catch (e) { /* ignore */ }
            try { toneNodes.gain.disconnect(); } catch (e) { /* ignore */ }
        }
        toneNodes = null;
        toggleToneButtons(false);
    }

    function toggleToneButtons(playing) {
        var playBtn = el.stage.querySelector('[data-test-tone]');
        var stopBtn = el.stage.querySelector('[data-test-stop-tone]');
        if (playBtn) playBtn.hidden = playing;
        if (stopBtn) stopBtn.hidden = !playing;
    }

    // ---- Record / playback ----
    function onRecordClick() {
        console.log('[CallTest] Record clicked. Stream present:', !!stream,
            'MediaRecorder available:', typeof MediaRecorder !== 'undefined');

        if (!stream) {
            setStatus('Start the test first.', 'error');
            return;
        }
        if (typeof window.MediaRecorder === 'undefined') {
            setStatus('Recording is not supported in this browser.', 'error');
            return;
        }
        if (mediaRecorder && mediaRecorder.state === 'recording') return;

        if (!recordingConsentGiven) {
            renderRecordConsent();
            return;
        }
        startRecording();
    }

    function renderRecordConsent() {
        var panel = el.stage.querySelector('.calltest-panel');
        if (!panel) return;
        var existing = panel.querySelector('[data-record-consent]');
        if (existing) existing.parentNode.removeChild(existing);

        var div = document.createElement('div');
        div.className = 'calltest-consent';
        div.setAttribute('data-record-consent', '');
        div.innerHTML =
            '<p>This records a 3-second clip using your mic. ' +
            'It stays in your browser and is never uploaded. Continue?</p>' +
            '<div class="calltest-consent-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-record-yes>Start recording</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-record-no>Cancel</button>' +
            '</div>';
        panel.insertBefore(div, panel.firstChild);

        wire(div.querySelector('[data-record-yes]'), 'click', function () {
            recordingConsentGiven = true;
            div.parentNode.removeChild(div);
            startRecording();
        });
        wire(div.querySelector('[data-record-no]'), 'click', function () {
            div.parentNode.removeChild(div);
        });
    }

    function startRecording() {
        recordedChunks = [];

        var audioTracks = stream.getAudioTracks();
        if (!audioTracks.length) {
            setStatus('No microphone track available. Try restarting the test.', 'error');
            return;
        }
        var audioStream = new MediaStream(audioTracks);
        console.log('[CallTest] Recording audio track:', audioTracks[0].label || '(unlabeled)');

        var mime = '';
        var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
        for (var i = 0; i < candidates.length; i++) {
            if (MediaRecorder.isTypeSupported(candidates[i])) {
                mime = candidates[i];
                break;
            }
        }
        console.log('[CallTest] Using mime:', mime || '(default)');

        try {
            mediaRecorder = mime
                ? new MediaRecorder(audioStream, { mimeType: mime })
                : new MediaRecorder(audioStream);
        } catch (e) {
            console.error('[CallTest] MediaRecorder create failed:', e);
            setStatus('Recording is not available for this device.', 'error');
            return;
        }

        mediaRecorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
                console.log('[CallTest] Chunk received:', e.data.size, 'bytes');
            }
        };

        mediaRecorder.onerror = function (e) {
            console.error('[CallTest] MediaRecorder error:', e);
            setStatus('Recording error: ' + (e.error && e.error.name ? e.error.name : 'unknown'), 'error');
        };

        mediaRecorder.onstop = function () {
            if (!recordedChunks.length) {
                setStatus('No audio captured. Try again.', 'error');
                resetRecordButton();
                return;
            }
            var blob = new Blob(recordedChunks, {
                type: recordedChunks[0].type || 'audio/webm'
            });
            console.log('[CallTest] Recording done:', blob.size, 'bytes,', blob.type);

            if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl);
            recordedBlobUrl = URL.createObjectURL(blob);

            var playBtn = el.stage.querySelector('[data-test-playback]');
            var delBtn = el.stage.querySelector('[data-test-delete]');
            var recBtn = el.stage.querySelector('[data-test-record]');
            if (playBtn) playBtn.hidden = false;
            if (delBtn) delBtn.hidden = false;
            if (recBtn) recBtn.disabled = false;
            setStatus('Recording ready. Play it back or delete it.');
        };

        try {
            mediaRecorder.start();
            console.log('[CallTest] Recording started');
        } catch (e) {
            console.error('[CallTest] mediaRecorder.start() failed:', e);
            setStatus('Could not start recording.', 'error');
            resetRecordButton();
            return;
        }

        var recBtn = el.stage.querySelector('[data-test-record]');
        if (recBtn) recBtn.disabled = true;

        var remaining = 3;
        setStatus('Recording... ' + remaining);
        var interval = setInterval(function () {
            remaining--;
            if (remaining > 0) {
                setStatus('Recording... ' + remaining);
            } else {
                clearInterval(interval);
                stopRecordingIfAny();
            }
        }, 1000);
    }

    function resetRecordButton() {
        var recBtn = el.stage.querySelector('[data-test-record]');
        if (recBtn) recBtn.disabled = false;
    }

    function stopRecordingIfAny() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try { mediaRecorder.stop(); } catch (e) { /* ignore */ }
        }
    }

    function playRecording() {
        if (!recordedBlobUrl) return;

        var holder = el.stage.querySelector('[data-test-audio-holder]');
        if (holder) holder.innerHTML = '';

        var audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'auto';
        audio.src = recordedBlobUrl;
        audio.className = 'calltest-audio';

        if (holder) holder.appendChild(audio);

        audio.play().catch(function (e) {
            console.warn('[CallTest] Playback autoplay blocked, user can press play:', e);
        });
    }

    function deleteRecording() {
        if (recordedBlobUrl) {
            URL.revokeObjectURL(recordedBlobUrl);
            recordedBlobUrl = null;
        }
        recordedChunks = [];

        var holder = el.stage.querySelector('[data-test-audio-holder]');
        if (holder) holder.innerHTML = '';

        var playBtn = el.stage.querySelector('[data-test-playback]');
        var delBtn = el.stage.querySelector('[data-test-delete]');
        var recBtn = el.stage.querySelector('[data-test-record]');
        if (playBtn) playBtn.hidden = true;
        if (delBtn) delBtn.hidden = true;
        if (recBtn) recBtn.disabled = false;
    }

    // ---- QR for phone ----
    function showPhoneQr() {
        var hostname = window.location.hostname || '';
        var isLocalhost = hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1' ||
            hostname === '0.0.0.0' ||
            hostname === '';

        if (isLocalhost) {
            renderPhoneQrInstructions();
            return;
        }

        var url = window.location.href.split('#')[0] + '#test';
        if (window.CodeGenerator && typeof window.CodeGenerator.open === 'function') {
            window.CodeGenerator.open(url);
        } else {
            setStatus('QR generator is not available.', 'error');
        }
    }

    function renderPhoneQrInstructions() {
        var existing = el.stage.querySelector('[data-phone-qr-help]');
        if (existing) existing.parentNode.removeChild(existing);

        var port = window.location.port || '8080';
        var div = document.createElement('div');
        div.className = 'calltest-consent';
        div.setAttribute('data-phone-qr-help', '');
        div.innerHTML =
            '<p><strong>You\'re viewing this via localhost.</strong> ' +
            'Your phone can\'t reach your computer\'s localhost — it needs your computer\'s network address.</p>' +
            '<ol class="calltest-consent-steps">' +
            '<li>Open a terminal on this computer</li>' +
            '<li>Run <code>ipconfig</code> (Windows) or <code>ifconfig</code> / <code>ip addr</code> (Mac/Linux)</li>' +
            '<li>Find your <strong>IPv4 address</strong> — it looks like <code>192.168.x.x</code> or <code>10.0.x.x</code></li>' +
            '<li>On your phone, open <code>http://YOUR-IP:' + escapeHtml(port) + '/#test</code></li>' +
            '</ol>' +
            '<p class="calltest-hint">Both devices must be on the same Wi-Fi network.</p>' +
            '<div class="calltest-consent-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-phone-qr-continue>Show QR anyway</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-phone-qr-cancel>Got it</button>' +
            '</div>';

        el.stage.insertBefore(div, el.stage.firstChild);

        div.querySelector('[data-phone-qr-continue]').addEventListener('click', function () {
            div.parentNode.removeChild(div);
            var url = window.location.href.split('#')[0] + '#test';
            if (window.CodeGenerator && typeof window.CodeGenerator.open === 'function') {
                window.CodeGenerator.open(url);
            }
        });
        div.querySelector('[data-phone-qr-cancel]').addEventListener('click', function () {
            div.parentNode.removeChild(div);
        });
    }

    // ---- Status bar ----
    function setStatus(text, kind) {
        if (!el.status) return;
        el.status.hidden = !text;
        el.status.textContent = text || '';
        el.status.classList.toggle('is-error', kind === 'error');
    }

    // ---- Helpers ----
    function wire(node, evt, fn) {
        if (node) node.addEventListener(evt, fn);
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ---- Bootstrap ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();