import React, { useState } from "react";
import ReactDOM from "react-dom";
import axios from 'axios';
// import * as mdb from 'mdb-ui-kit'; // lib
// import { Input } from 'mdb-ui-kit'; // module

// import MagicDropzone from "react-magic-dropzone";
import "./styles.css";
let display = true;
const tf = require('@tensorflow/tfjs');
const weights = '/web_model_old/model.json';
const headers = {
  'Content-Type': 'application/json'
}
const names = ['Calculator', 'Cup', 'Ear_Piece', 'GoogleGlass', 'Head_Phone', 'Laptop',
  'MobilePhone', 'Notebook', 'Pen', 'Smart_watch', 'Spec', 'SunGlass'
]
const [modelWeight, modelHeight] = [640, 640];




class App extends React.Component {

  realValue = this.value
  videoRef = React.createRef();
  canvasRef = React.createRef();

  state = {
    model: null,
    preview: "",
    userid: "",
    proctorid: "",
    examid: "",
    predictions: []
  };


  componentDidMount() {

  }
  constructor(props) {

    super(props)
    this.state = {
      model: null,
      preview: "",
      userid: "",
      proctorid: "",
      examid: "",
      predictions: []
    };
    this.handleSubmit = this.handleSubmit.bind(this)
    this.handleuserChange = this.handleuserChange.bind(this)
    this.handleExamChange = this.handleExamChange.bind(this)
    this.handleproctorChange = this.handleproctorChange.bind(this)
  }

  startcamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const webCamPromise = navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: {
            facingMode: "user"
          }
        })
        .then(stream => {
          window.stream = stream;
          this.videoRef.current.srcObject = stream;
          return new Promise((resolve, reject) => {
            this.videoRef.current.onloadedmetadata = () => {
              resolve();
            };
          });
        });

      const modelPromise = tf.loadGraphModel(weights).then(model => {
        this.setState({
          model: model
        });
        console.log("model ready......", model)
        return this.state.model;
      });
      Promise.all([modelPromise, webCamPromise])
        .then(values => {
          // this.detectFrame(this.videoRef.current, values[0]);
          this.checkwithVideo()
        })
        .catch(error => {
          console.error(error);
        });
    }
  }
  pushToDynamodb = (predict) => {
    let test = {
      "id": `${this.state.userid}_${this.state.examid}`,
      "eid": this.state.examid,
      "cid": this.state.userid,
      "ts": predict.timestamp,
      "pid": this.state.proctorid,
      "predict": JSON.stringify(predict)
    }
    var value = test.predict
    console.log(value, 'valusxdfcghj')
    axios.post('https://sh3x2x9en3.execute-api.us-east-1.amazonaws.com/test/', test, { headers: headers })
      .then(response => {
        //console.log(response)
      }).catch(err => {
        //console.log(err)
      })
  }


  checkwithVideo = () => {
    let videointerval;
    if (videointerval === undefined) {
      videointerval = setInterval(() => {
        this.onImageChange()
      }, 100)
    }
  };

  cropToCanvas = (image, canvas, ctx) => {
    const naturalWidth = image.videoWidth;
    const naturalHeight = image.videoHeight;
    // canvas.width = image.width;
    // canvas.height = image.height;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ratio = Math.min(canvas.width / image.videoWidth, canvas.height / image.videoHeight);
    const newWidth = Math.round(naturalWidth * ratio);
    const newHeight = Math.round(naturalHeight * ratio);
    ctx.drawImage(this.videoRef.current, 0, 0, naturalWidth, naturalHeight, (canvas.width - newWidth) / 2, (canvas.height - newHeight) / 2, newWidth, newHeight,);
  };

  onImageChange = () => {
    const canvas = this.canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // this.cropToCanvas(this.videoRef.current, canvas, ctx);
    const input = tf.tidy(() => {
      return tf.image.resizeBilinear(tf.browser.fromPixels(this.videoRef.current), [modelWeight, modelHeight])
        .div(255.0).expandDims(0);
    });
    this.state.model.executeAsync(input).then(res => {
      let detectiondata = {
        detection: [],
        timestamp: ""
      };
      // Font options.
      const font = "16px sans-serif";
      ctx.font = font;
      ctx.textBaseline = "top";
      const [boxes, scores, classes, valid_detections] = res;
      const boxes_data = boxes.dataSync();
      const scores_data = scores.dataSync();
      const classes_data = classes.dataSync();
      const valid_detections_data = valid_detections.dataSync()[0];
      tf.dispose(res)
      tf.dispose(input)



      var i;
      for (i = 0; i < valid_detections_data; ++i) {
        let [x1, y1, x2, y2] = boxes_data.slice(i * 4, (i + 1) * 4);
        x1 *= canvas.width;
        x2 *= canvas.width;
        y1 *= canvas.height;
        y2 *= canvas.height;
        const width = x2 - x1;
        const height = y2 - y1;
        const klass = names[classes_data[i]];
        const score = scores_data[i].toFixed(2);
        // Draw the bounding box.
        ctx.strokeStyle = "#00FFFF";
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, width, height);
        //console.log('x1',x1)
        // Draw the label background.
        ctx.fillStyle = "#00FFFF";
        const textWidth = ctx.measureText(klass + ":" + score).width;
        const textHeight = parseInt(font, 10); // base 10
        ctx.fillRect(x1, y1, textWidth + 4, textHeight + 4);
      }
      for (i = 0; i < valid_detections_data; ++i) {
        let [x1, y1, ,] = boxes_data.slice(i * 4, (i + 1) * 4);
        x1 *= canvas.width;
        y1 *= canvas.height;
        const klass = names[classes_data[i]];
        const score = scores_data[i].toFixed(2);
        //console.log('klass ',klass, ', score', score)
        detectiondata.detection.push({ "class": klass, "score": score })
        // Draw the text last to ensure it's on top.
        ctx.fillStyle = "#000000";
        ctx.fillText(klass + ":" + score, x1, y1);
      }
      detectiondata.timestamp = Date.now()
      if (detectiondata.detection && detectiondata.detection.length > 0) {
        this.pushToDynamodb(detectiondata)
      }
      // this.onImageChange()
      // console.log(score)
    });
  };

  handleuserChange(event) {
    this.setState({
      userid: event.target.value
    })
  }

  handleExamChange(event) {
    this.setState({
      examid: event.target.value
    })
  }

  handleproctorChange(event) {
    this.setState({
      proctorid: event.target.value
    })
  }

  handleSubmit(event) {
    event.preventDefault();
    if (this.state.userid !== "" && this.state.examid !== "" && this.state.proctorid !== "") {
      this.startcamera()
    }
  }

  render() {

    return (

      // <div className="container">
      <div className="row ">
        <div className="col-md-2">
          <h1 className="heading">Object Detection </h1>
          <form className="p-2" onSubmit={this.handleSubmit}>
            <div className="form-group mar">
              <label htmlFor="candiadteID">Candidate ID:</label>
              <input type="text" className='form-control' id='candiadateId' value={this.state.userid} placeholder="enter candidateId" onChange={this.handleuserChange} />
            </div>
            <div className="form-group  mar">
              <label htmlFor="examID">Exam ID:</label>
              <input type="text" className='form-control' value={this.state.examid} onChange={this.handleExamChange} placeholder='enter examID' />
            </div>
            <div className="form-group  mar">
              <label htmlFor="proctorID">Proctor ID:</label>
              <input type="text" className='form-control' value={this.state.proctorid} onChange={this.handleproctorChange} placeholder='enter proctorID' />
            </div>
            <input type="submit" className="btn button-width text-white" value="Submit" />

          </form>

        </div>



        <div className="col-md-5 style1">

          <video
            className="test"
            autoPlay
            // style={{ visibility: 'hidden' }}
            muted
            ref={this.videoRef}
            width="500"
            height="500"
          />

        </div>


        <div className=" canva">
          <h1 className="heading">Proctor View </h1>
          {/* <h3>{detectiondata}</h3> */}
          <canvas
            className="size"
            ref={this.canvasRef}
            style={{ visibility: '' }}
            width="500"
            height="500"
          />
        </div>




      </div>
      // </div>
    );
  }
}
const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);