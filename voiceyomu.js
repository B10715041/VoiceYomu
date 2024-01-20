// ==UserScript==
// @name         VoiceYomu
// @namespace    http://tampermonkey.net/
// @version      2023-01-21
// @description  Send selected text to voicevox server and play the response voice
// @author       Hsiao-Chieh, Ma
// @match        https://kakuyomu.jp/*/*
// @match        https://ncode.syosetu.com/*/*
// @icon         https://cdn-static.kakuyomu.jp/images/brand/favicons/app-256.png
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
  'use strict';

  var MIN_SENTENCE_LENGTH = 20;
  var HOST = '192.168.1.118';

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
          <option value="10">雨晴はう</option>
          <option value="14">冥鳴ひまり</option>
          <option value="20">もち子さん</option>
          <option value="23">WhiteCUL</option>
          <option value="47">ナースロボ＿タイプＴ</option>
          <option value="58">猫使ビィ</option>
          <option value="Natsume">四季ナツメ</option>
        </select>
      </div>

      <div id="voicevox-sliders">
        <div class="settings-row">
          <label for="volume-slider">音量 </label>
          <input type="range" id="volume-slider" min="0" max="2" step="0.1" value="1">
          <span class="value-display" id="volume-display">1.0</span>
        </div>

        <div class="settings-row">
          <label for="pitch-slider">高さ </label>
          <input type="range" id="pitch-slider" min="-0.15" max="0.15" step="0.01" value="0">
          <span class="value-display" id="pitch-display">0.00</span>
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
      </div>

      <!-- Natsume settings -->
      <div id="natsume-settings" style="display: none;">
        <div class="settings-row">
          <label for="sdp-ratio-slider">SDP Ratio</label>
          <input type="range" id="sdp-ratio-slider" min="0" max="1" step="0.1" value="0.5">
          <span id="sdp-ratio-display">0.5</span>
        </div>
        <div class="settings-row">
          <label for="noise-scale-slider">Noise</label>
          <input type="range" id="noise-scale-slider" min="0" max="2" step="0.1" value="0.6">
          <span id="noise-scale-display">0.6</span>
        </div>
        <div class="settings-row">
          <label for="noise-scale-w-slider">Noise W</label>
          <input type="range" id="noise-scale-w-slider" min="0" max="2" step="0.1" value="0.9">
          <span id="noise-scale-w-display">0.9</span>
        </div>
        <div class="settings-row">
          <label for="length-scale-slider">Length</label>
          <input type="range" id="length-scale-slider" min="0.1" max="2" step="0.1" value="1">
          <span id="length-scale-display">1.0</span>
        </div>
        <div class="settings-row">
          <label for="wsl2-ip-input">Host</label>
          <input type="text" id="wsl2-ip-input" value="127.0.0.1">
        </div>
      </div>
      <!-- Natsume settings end -->

      <button id="reset-sliders">RESET Sliders</button>
    </div>

    <style>
      /* Panel CSS */
      #voicevox-panel {
        /* Set the background image */
        background-image: url('https://voicevox.hiroshiba.jp/static/f0dd9ef1a6128916921e1b3e5b817188/90d07/bustup-shikoku_metan.webp'); 
        background-size: cover; /* make sure the image covers the entire panel */
        background-position: center; /* center the image in the panel */
        background-repeat: no-repeat; /* rrevent the image from repeating */
      }

      #voicevox-panel .settings-row,
      #voicevox-panel label,
      #voicevox-panel .value-display,
      #voicevox-panel select,
      #voicevox-panel input[type=range],
      #voicevox-panel button {
        opacity: 0.9;       
      }

      #voicevox-panel .settings-row {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }

      #voicevox-panel label {
        margin-right: 5px;
      }

      #voicevox-panel .value-display {
        width: 45px;
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

    .sentence:hover {
      text-decoration: underline;
      cursor: pointer;
    }
    </style>
  `;

  document.body.insertAdjacentHTML('beforeend', panelHTML);

  var speakerImageMap = {
    '2': 'https://voicevox.hiroshiba.jp/static/f0dd9ef1a6128916921e1b3e5b817188/90d07/bustup-shikoku_metan.webp',
    '3': 'https://voicevox.hiroshiba.jp/static/872d600b9b7872e389de2bb3888f9de5/90d07/bustup-zundamon.webp',
    '8': 'https://voicevox.hiroshiba.jp/static/046153ad2a4ff3b8f3b238fbb6c3024a/90d07/bustup-kasukabe_tsumugi.webp',
    '10': 'https://voicevox.hiroshiba.jp/static/787b7910f89088ba30dc089704a2a6a5/90d07/bustup-amehare_hau.webp',
    '14': 'https://voicevox.hiroshiba.jp/static/2c28b01dc088f64b901f8cfbe273ec85/90d07/bustup-meimei_himari.webp',
    '20': 'https://voicevox.hiroshiba.jp/static/33a2e472b53194c79ec2eac3e1d1b39e/90d07/bustup-mochikosan.webp',
    '23': 'https://voicevox.hiroshiba.jp/static/0e11b3f7df4ead3289a19d1535f21da1/90d07/bustup-white_cul.webp',
    '47': 'https://voicevox.hiroshiba.jp/static/784a947d7d05852cef6598c065cc5b61/90d07/bustup-nurserobo_typet.webp',
    '58': 'https://voicevox.hiroshiba.jp/static/84a6703fd70f01e44a34e6aa2ffe361f/90d07/bustup-nekotsuka_bi.webp',
    'Natsume': 'https://ec-russell.jp/yuz/image/item/detail/6059/1'
  };

  function attachSliderEventListeners() {
    var volumeSlider = document.getElementById('volume-slider');
    var speedSlider = document.getElementById('speed-slider');
    var pitchSlider = document.getElementById('pitch-slider');
    var intonationSlider = document.getElementById('intonation-slider');

    volumeSlider.addEventListener('input', function() {
      GM_setValue('volume', volumeSlider.value);
      document.getElementById('volume-display').textContent = Number(volumeSlider.value).toFixed(1);
    });

    speedSlider.addEventListener('input', function() {
      GM_setValue('speed', speedSlider.value);
      document.getElementById('speed-display').textContent = Number(speedSlider.value).toFixed(1);
    });

    pitchSlider.addEventListener('input', function() {
      GM_setValue('pitch', pitchSlider.value);
      document.getElementById('pitch-display').textContent = Number(pitchSlider.value).toFixed(2);
    });

    intonationSlider.addEventListener('input', function() {
      GM_setValue('intonation', intonationSlider.value)
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
      document.getElementById('pitch-display').textContent = "0.00";
      document.getElementById('intonation-display').textContent = "1.0";
    });


    var speakerSelect = document.getElementById('speaker-select');
    var panel = document.getElementById('voicevox-panel');

    speakerSelect.addEventListener('change', function(event) {
      GM_setValue('speakerId', speakerSelect.value);
      var selectedSpeaker = speakerSelect.value;
      var imageUrl = speakerImageMap[selectedSpeaker];
      if (imageUrl) {
        panel.style.backgroundImage = 'url(' + imageUrl + ')';
      }

      if (event.target.value === 'Natsume') {
        document.getElementById('voicevox-sliders').style.display = 'none';
        document.getElementById('natsume-settings').style.display = 'block';
      } else {
        document.getElementById('voicevox-sliders').style.display = 'block';
        document.getElementById('natsume-settings').style.display = 'none';
      }
    });

  }

  function loadSettings() {
    // Retrieve and parse the values, providing default values if necessary
    var savedVolume = parseFloat(GM_getValue('volume', '1.0'));
    document.getElementById('volume-slider').value = savedVolume;
    document.getElementById('volume-display').textContent = savedVolume.toFixed(1);

    var savedSpeed = parseFloat(GM_getValue('speed', '1.0'));
    document.getElementById('speed-slider').value = savedSpeed;
    document.getElementById('speed-display').textContent = savedSpeed.toFixed(1);

    var savedPitch = parseFloat(GM_getValue('pitch', '0.0'));
    document.getElementById('pitch-slider').value = savedPitch;
    document.getElementById('pitch-display').textContent = savedPitch.toFixed(2);

    var savedIntonation = parseFloat(GM_getValue('intonation', '1.0'));
    document.getElementById('intonation-slider').value = savedIntonation;
    document.getElementById('intonation-display').textContent = savedIntonation.toFixed(1);

    var savedSpeakerId = GM_getValue('speakerId', '2'); // Default to '2' if not set
    document.getElementById('speaker-select').value = savedSpeakerId;
    var imageUrl = speakerImageMap[savedSpeakerId];
    if (imageUrl) {
      document.getElementById('voicevox-panel').style.backgroundImage = 'url(' + imageUrl + ')';
    }
  }


  attachSliderEventListeners();
  loadSettings();

  // Toggle panel display
  document.addEventListener('keydown', function(e) {
    if (e.key === 'p') {
      var panel = document.getElementById('voicevox-panel');
      panel.style.display = (panel.style.display === 'none' ? 'block' : 'none');
    }
  });

  function removeFurigana(text) {
    // Create a temporary div element
    var tempDiv = document.createElement('div');
    // Set the innerHTML to the text
    tempDiv.innerHTML = text;
    // Remove <ruby> elements
    tempDiv.querySelectorAll('ruby').forEach(function(ruby) {
      // Replace the ruby element with its rb (kanji) content only
      ruby.replaceWith(ruby.querySelector('rb') || ruby.innerText);
    });
    // Return the cleaned text
    return tempDiv.innerText.trim();
  }


  function sendTextToVoiceVox(text) {
    var speakerId = document.getElementById('speaker-select').value

    // First, get the audio query
    GM_xmlhttpRequest({
      method: 'POST',
      url: 'http://' + HOST + ':50021/audio_query?text=' + encodeURIComponent(text) + '&speaker=' + speakerId,
      headers: {
        "accept": "application/json"
      },
      onload: function(response) {
        if (response.status >= 200 && response.status < 300) {
          var queryData = JSON.parse(response.responseText);
          synthesizeVoice(queryData, 'http://' + HOST + ':50021/synthesis?speaker=' + speakerId);
        } else {
          console.error('VoiceVox audio_query API error:', response.statusText);
        }
      },
      onerror: function(response) {
        console.error('VoiceVox audio_query API error:', response.statusText);
      }
    });
  }

  function getNatsumeAudio(text) {
    var sdpRatio = document.getElementById('sdp-ratio-slider').value;
    var noiseScale = document.getElementById('noise-scale-slider').value;
    var noiseScaleW = document.getElementById('noise-scale-w-slider').value;
    var lengthScale = document.getElementById('length-scale-slider').value;
    var wsl2IP = document.getElementById('wsl2-ip-input').value;

    var url = `http://${wsl2IP}:5000/synthesize?text=${encodeURIComponent(text)}&sdp_ratio=${sdpRatio}&noise_scale=${noiseScale}&noise_scale_w=${noiseScaleW}&length_scale=${lengthScale}&language=JP`;

    // 音声を取得し再生
    fetch(url)
      .then(response => response.blob())
      .then(blob => playAudioBlob(blob))
      .catch(error => console.error('Error fetching Natsume audio:', error));
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
    // Skip empty paragraphs or paragraphs within a specific class
    if (paragraph.innerHTML.trim() === '' ||
      paragraph.classList.contains('blank') || // for kakuyomu
      paragraph.classList.contains('ui-tooltip') || // for kakuyomu
      paragraph.innerHTML.trim().replace(/<br\s*\/?>/gi, '') === '') { // for narou
      return;
    }

    // Split the paragraph into sentences
    var sentences = removeFurigana(paragraph.innerHTML).split(/(\?|。|!)/);
    var combinedSentences = [];
    var tempSentence = '';


    for (var i = 0; i < sentences.length; i++) {
      tempSentence += sentences[i];
      // Check if it's the end of a sentence or the last element
      if (i % 2 !== 0 || i === sentences.length - 1) {
        if (tempSentence.length < MIN_SENTENCE_LENGTH) {
          // If the sentence is short, combine it with the next one
          continue;
        }
        combinedSentences.push(tempSentence);
        tempSentence = '';
      }
    }

    if (tempSentence.length > 0) {
      combinedSentences.push(tempSentence); // Add any remaining sentence
    }

    var newHTML = combinedSentences.map(function(sentence) {
      return '<span class="sentence">' + sentence + '</span>';
    }).join('');
    paragraph.innerHTML = newHTML;

    // Add click event listener to each sentence
    paragraph.querySelectorAll('.sentence').forEach(function(sentenceSpan) {
      sentenceSpan.addEventListener('click', handleSentenceClick, false);
    });
  });

  function handleSentenceClick(event) {
    event.preventDefault();
    var text = event.target.textContent || event.target.innerText;
    console.log("Captured Sentence:", text);

    var speakerId = document.getElementById('speaker-select').value;
    if (speakerId === 'Natsume') {
      getNatsumeAudio(text);
    } else {
      sendTextToVoiceVox(text);
    }
  }

})();
