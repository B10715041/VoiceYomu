// ==UserScript==
// @name         VoiceYomu
// @namespace    http://tampermonkey.net/
// @version      2023-12-27
// @description  Send selected text to voicevox server and play the response voice
// @author       Hsiao-Chieh, Ma
// @match        https://kakuyomu.jp/*/*
// @icon         https://cdn-static.kakuyomu.jp/images/brand/favicons/app-256.png
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
  'use strict';

  var currentAudio = null;
  var panelHTML = `
    <div id="voicevox-panel" style="position: fixed; bottom: 10px; right: 10px; background-color: white; border: 1px solid black; padding: 10px; width: 250px; display: None;">
      <div class="settings-row">
        <label for="speaker-select">話者ID </label>
        <select id="speaker-select">
          <!-- Populate with options -->
          <option value="2">四国めたん</option>
          <option value="3">ずんだもん</option>
          <option value="8">春日部つむぎ</option>
          <option value="14">冥鳴ひまり</option>
          <option value="47">ナースロボ＿タイプＴ</option>
        </select>
      </div>

      <div class="settings-row">
        <label for="volume-slider">音量 </label>
        <input type="range" id="volume-slider" min="0" max="2" step="0.1" value="1">
        <span class="value-display" id="volume-display">1.0</span>
      </div>

      <div class="settings-row">
        <label for="pitch-slider">高さ </label>
        <input type="range" id="pitch-slider" min="-0.15" max="0.15" step="0.01" value="0">
        <span class="value-display" id="pitch-display">0.0</span>
      </div>

      <div class="settings-row">
        <label for="speed-slider">話速 </label>
        <input type="range" id="speed-slider" min="0.5" max="2" step="0.1" value="1">
        <span class="value-display" id="speed-display">1.0</span>
      </div>

      <div class="settings-row">
        <label for="intonation-slider">抑揚 </label>
        <input type="range" id="intonation-slider" min="0" max="2" step="0.1" value="1">
        <span class="value-display" id="intonation-display">1.0</span>
      </div>

      <button id="reset-sliders">RESET Sliders</button>
    </div>

    <style>
      /* Panel CSS */
      #voicevox-panel .settings-row {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }

      #voicevox-panel label {
        margin-right: 5px;
      }

      #voicevox-panel .value-display {
        width: 30px;
        /* Fixed width for the value display */
        text-align: right;
        margin-left: 10px;
      }

      #voicevox-panel select,
      #voicevox-panel input[type=range],
      #voicevox-panel button {
        flex-grow: 1;
      }

      #voicevox-panel button {
        margin-top: 10px;
      }
    </style>
  `;
  document.body.insertAdjacentHTML('beforeend', panelHTML);

  function attachSliderEventListeners() {
    var volumeSlider = document.getElementById('volume-slider');
    var speedSlider = document.getElementById('speed-slider');
    var pitchSlider = document.getElementById('pitch-slider');
    var intonationSlider = document.getElementById('intonation-slider');

    volumeSlider.addEventListener('input', function() {
      document.getElementById('volume-display').textContent = Number(volumeSlider.value).toFixed(1);
    });

    speedSlider.addEventListener('input', function() {
      document.getElementById('speed-display').textContent = Number(speedSlider.value).toFixed(1);
    });

    pitchSlider.addEventListener('input', function() {
      document.getElementById('pitch-display').textContent = Number(pitchSlider.value).toFixed(1);
    });

    intonationSlider.addEventListener('input', function() {
      document.getElementById('intonation-display').textContent = Number(intonationSlider.value).toFixed(1);
    });

    // Event listener for the RESET button
    document.getElementById('reset-sliders').addEventListener('click', function() {
      volumeSlider.value = 1.0;
      speedSlider.value = 1.0;
      pitchSlider.value = 0.0;
      intonationSlider.value = 1.0;
      document.getElementById('volume-display').textContent = "1.0";
      document.getElementById('speed-display').textContent = "1.0";
      document.getElementById('pitch-display').textContent = "0.0";
      document.getElementById('intonation-display').textContent = "1.0";
    });
  }

  attachSliderEventListeners();

  // Toggle panel display
  document.addEventListener('keydown', function(e) {
    if (e.key === 'p') {
      var panel = document.getElementById('voicevox-panel');
      panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
    }
  });

  function getSentenceFromSelection(selection) {
    // Get the text from the selection range
    let text = selection.toString();

    // Regular expression to match a sentence
    let sentenceRegex = /[^.!?]*[.!?]/g;
    let sentences = text.match(sentenceRegex);

    if (sentences && sentences.length > 0) {
      // Return the first sentence (you may need to adjust this logic)
      return sentences[0];
    }

    return text; // Fallback to return the whole text if no sentence is found
  }

  // Function to handle click event on a paragraph
  function handleParagraphClick(event) {
    // Prevent default behavior
    event.preventDefault();

    // Get the text of the clicked paragraph
    var text = event.target.innerText.trim();
    // Get the current selection
    var selection = window.getSelection();
    // Check if there is highlighted text
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      // Get the sentence from the selection
      text = getSentenceFromSelection(selection);
    }
    // Check if the text is not empty
    if (text) {
      console.log("Captured Text:", text);
      sendTextToVoiceVox(text); // Replace '1' with the desired speaker ID
    }
  }

  function sendTextToVoiceVox(text) {
    var host = '192.168.1.118'
    var speakerId = document.getElementById('speaker-select').value

    // First, get the audio query
    GM_xmlhttpRequest({
      method: 'POST',
      url: 'http://' + host + ':50021/audio_query?text=' + encodeURIComponent(text) + '&speaker=' + speakerId,
      headers: {
        "accept": "application/json"
      },
      onload: function(response) {
        if (response.status >= 200 && response.status < 300) {
          var queryData = JSON.parse(response.responseText);
          synthesizeVoice(queryData, 'http://' + host + ':50021/synthesis?speaker=' + speakerId);
        } else {
          console.error('VoiceVox audio_query API error:', response.statusText);
        }
      },
      onerror: function(response) {
        console.error('VoiceVox audio_query API error:', response.statusText);
      }
    });
  }

  function synthesizeVoice(queryData, synthesisEndpoint) {

    queryData['speedScale'] = document.getElementById('speed-slider').value;
    queryData['pitchScale'] = document.getElementById('pitch-slider').value;
    queryData['intonationScale'] = document.getElementById('intonation-slider').value;
    queryData['volumeScale'] = document.getElementById('volume-slider').value;


    GM_xmlhttpRequest({
      method: 'POST',
      url: synthesisEndpoint,
      headers: {
        'Content-Type': 'application/json',
        'accept': 'audio/wav'
      },
      data: JSON.stringify(queryData),
      responseType: 'blob',
      onload: function(response) {
        if (response.status >= 200 && response.status < 300) {
          playAudioBlob(response.response);
        } else {
          console.error('VoiceVox synthesis API error:', response.statusText);
        }
      },
      onerror: function(response) {
        console.error('VoiceVox synthesis API error:', response.statusText);
      }
    });
  }

  function playAudioBlob(blob) {
    var url = URL.createObjectURL(blob);

    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    currentAudio = new Audio(url);
    currentAudio.play();
  }


  document.querySelectorAll('p').forEach(function(paragraph) {
    paragraph.addEventListener('click', handleParagraphClick, false);
  });



})();
