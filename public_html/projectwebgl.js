/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var VSHADER_SOURCE=
        'attribute vec4 a_Pos; \n'+
        'attribute vec4 a_Col; \n'+
        'attribute vec2 a_TexCoord; \n'+
        'uniform mat4 a_trans; \n'+
        'uniform mat4 a_view; \n'+
        'uniform mat4 a_proj; \n'+
        'varying vec4 v_Col; \n'+
        'varying vec2 v_TexCoord; \n'+
        'void main(){ \n'+
        '   gl_Position=a_proj*a_view*a_trans*a_Pos; \n'+
        '   gl_PointSize=5.0; \n'+
        '   v_Col=a_Col; \n'+
        '   v_TexCoord=a_TexCoord; \n'+
        '}\n';
var FSHADER_SOURCE=
        'precision mediump float; \n'+
        'uniform sampler2D u_texture; \n'+
        'varying vec4 v_Col; \n'+
        'varying vec2 v_TexCoord; \n'+
        'void main(){ \n'+
        '   gl_FragColor=texture2D(u_texture,v_TexCoord)*v_Col; \n'+
        '}\n';
var map;
var gl;

var transMat=new Matrix4();//블럭 이동
var viewMat=new Matrix4();//시점 조절
var viewEye=new Vector3([0,0.05,0.15]);//[0,0.05,0.15]//[0,0.6,2]
var viewAt=new Vector3([0.0,0.05,0.05]);//[0.0,0.05,0.05]
var ex_viewEye=new Vector3([0,0,0]);
var ex_viewAt=new Vector3([0,0,0]);
var viewUp=new Vector3([0,1,0]);
var projMat=new Matrix4();//시야 조절

var rotateVec=new Vector4([viewAt.elements[0]-viewEye.elements[0],
                                viewAt.elements[1]-viewEye.elements[1],
                                viewAt.elements[2]-viewEye.elements[2],
                                1]);//마우스로 시야 변경하기 위한 벡터

var aPosLoc;//좌표
var aColLoc;//색상
var aTexLoc;
var aTransLoc;//이동
var aViewLoc;//시점
var aProjLoc;//시야

var points=[-1, 0, -1, 1, 1, 1, 0, 1,//왼쪽 뒤
            -1, 0, 1, 1, 1, 1, 0, 0,//왼쪽 앞
            1, 0, 1, 1, 1, 1, 1, 0,//오른쪽 앞
            1, 0, -1, 1, 1, 1, 1, 1,//오른쪽 뒤
            //땅
            -1, 0, -1, 1, 1, 1, 0, 0,
            1, 0, -1, 1, 1, 1, 1, 0,
            1, 1, -1, 1, 1, 1, 1, 1,
            -1, 1, -1, 1, 1, 1, 0, 1,
            //뒷벽
            -1, 0, -1, 1, 1, 1, 1, 0,
            -1, 1, -1, 1, 1, 1, 1, 1,
            -1, 1, 1, 1, 1, 1, 0, 1,
            -1, 0, 1, 1, 1, 1, 0, 0,
            //왼벽
            1, 0, -1, 1, 1, 1, 0, 0,
            1, 0, 1, 1, 1, 1, 1, 0,
            1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, -1, 1, 1, 1, 0, 1
            //오른벽
            ];
var points_buf;
var boxpoints=new Array();
var boxindexs=new Array();
var box_buf;
var box_buf_index;

var clicked_x=0;
var clicked_z=0;
var ex_posx=0;
var ex_posy=0;
var boxcount=0;//만든 박스의 개수
var deletecount=0;
var floorcount=0;//밑에있는 블럭의 개수
var floorbox;//밟고 있는 박스의 인덱스값
var durability=0;
var boxlimit=9;//재료 제한(생성 가능 박스 수 제한) 단계마다 -2
var successCut=3;//성공하기 위한 벽 수 단계마다 +1

var boxmode=0;
var startmode=0;

var audio_context;
var audio_buf=null;

var map;
var gl_h;

var blockEle;
var modeEle;
var durabilityEle;
var roundEle;

var newObjDrawingInfo  = null;
var newObjDrawingInfo2  = null;

function main(){
    map=document.getElementById('map');
    gl=map.getContext('webgl');//gl에 맵 정보 저장
    hud=document.getElementById('hud');
    gl_h=hud.getContext('2d');
    
    initShaders(gl,VSHADER_SOURCE,FSHADER_SOURCE);
    gl.clearColor(1,1,1,1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | 
            gl.DEPTH_BUFFER_BIT |
            gl.STENCIL_BUFFER_BIT);
    initialize();//초기화
    draw();//그리기
    
    document.onkeydown=function(event){
        keydown(event);
    };
    map.onmousedown=function(event){
        clicked();
        console.log(boxcount);
    };
    map.onmousemove=function(event){
        //moved(event);
    };
}
function initialize(){
    var startImage=new Image();
    startImage.src='표지.jpg';
    startImage.onload=function(){
        gl_h.drawImage(startImage,0,0,1200,800);
     };
    gl_h.drawImage(startImage,0,0,0,0);
    aPosLoc=gl.getAttribLocation(gl.program,'a_Pos');
    aColLoc=gl.getAttribLocation(gl.program,'a_Col');    
    aTexLoc=gl.getAttribLocation(gl.program,'a_TexCoord');    
    aViewLoc=gl.getUniformLocation(gl.program,'a_view');
    aProjLoc=gl.getUniformLocation(gl.program,'a_proj');
    aTransLoc=gl.getUniformLocation(gl.program,'a_trans');
    
    transMat.setIdentity();
    projMat.setPerspective(45,1,0.001,100);
    //45도, 가로:세로=1:1, 0.1~100거리 관측가능
    viewMat.setLookAt(viewEye.elements[0],viewEye.elements[1],viewEye.elements[2],
                    viewAt.elements[0],viewAt.elements[1],viewAt.elements[2],
                    viewUp.elements[0],viewUp.elements[1],viewUp.elements[2]);
    
    gl.uniformMatrix4fv(aViewLoc,false,viewMat.elements);
    gl.uniformMatrix4fv(aProjLoc,false,projMat.elements);
    gl.uniformMatrix4fv(aTransLoc,false,transMat.elements); 
    
    points_buf=gl.createBuffer();
    box_buf=gl.createBuffer();
    box_buf_index=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,box_buf);//버퍼 연결  
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,box_buf_index);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(boxpoints),gl.STATIC_DRAW);//배열에서   
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint8Array(boxindexs),gl.STATIC_DRAW);//배열에서   
    gl.bindBuffer(gl.ARRAY_BUFFER,points_buf);//버퍼 연결   
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);//배열에서   
    gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 4*8, 0);//3개씩
    gl.vertexAttribPointer(aColLoc, 3, gl.FLOAT, false, 4*8, 4*3);//꺼내씀
    gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 4*8, 4*6);//꺼내씀
    gl.enableVertexAttribArray(aPosLoc);
    gl.enableVertexAttribArray(aColLoc);
    gl.enableVertexAttribArray(aTexLoc);
    
    var texImage1=new Image();
	texImage1.crossOrigin="Anonymous";
    texImage1.onload = function () {
        gl.texID1 = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, gl.texID1);
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texImage1);
       
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);       
    };
    texImage1.src = '블록.jpg';
    //블록
    var texImage2=new Image();
	texImage2.crossOrigin="Anonymous";
    texImage2.onload = function () {
        gl.texID2 = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, gl.texID2);
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texImage2);
       
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);       
    };
    texImage2.src = '배경1.jpg';
    //배경(왼)
    var texImage3=new Image();
	texImage3.crossOrigin="Anonymous";
    texImage3.onload = function () {
        gl.texID3 = gl.createTexture();
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, gl.texID3);
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texImage3);
       
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);       
    };
    texImage3.src = '배경2.jpg';
    //배경(중)
    var texImage4=new Image();
	texImage4.crossOrigin="Anonymous";
    texImage4.onload = function () {
        gl.texID4 = gl.createTexture();
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, gl.texID4);
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texImage4);
       
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);       
    };
    texImage4.src = '배경3.jpg';
    //배경(오)
    var texImage5=new Image();
	texImage5.crossOrigin="Anonymous";
    texImage5.onload = function () {
        gl.texID5 = gl.createTexture();
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, gl.texID5);
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texImage5);
       
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);       
    };
    texImage5.src = '바닥.jpg';
    //배경(바닥)
    
    var texImage6=new Image();
	texImage6.crossOrigin="Anonymous";
    texImage6.onload = function () {
        gl.texID6 = gl.createTexture();
        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_2D, gl.texID6);
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texImage6);
       
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);       
    };
    texImage6.src = 'blockTest3.jpg';
    //흰
    
    
    audio_context=new AudioContext();
    loadAudio("http://localhost:8383/프로젝트_연습/배경_음악.mp3");
    var o = null;
    readOBJFile("PiggyBank.obj", gl, o, 0.01, false);    
    var o2 = null;
    readOBJFile2("wolf.obj", gl, o2, 0.0001, false);
    
}
function draw(){
    
    gl_h.clearRect(0, 0, hud.width, hud.height);
    gl.clear(gl.COLOR_BUFFER_BIT | 
    gl.DEPTH_BUFFER_BIT |
    gl.STENCIL_BUFFER_BIT);
    viewMat.setLookAt(viewEye.elements[0],viewEye.elements[1],viewEye.elements[2],
                    viewAt.elements[0],viewAt.elements[1],viewAt.elements[2],
                    viewUp.elements[0],viewUp.elements[1],viewUp.elements[2]);
                    //시야 정보 업데이트
    gl.uniformMatrix4fv(aViewLoc,false,viewMat.elements);
    gl.uniformMatrix4fv(aProjLoc,false,projMat.elements);
    gl.uniformMatrix4fv(aTransLoc,false,transMat.elements);
    //유니폼 변수 정보 업데이트
    gl.bindBuffer(gl.ARRAY_BUFFER,points_buf);//버퍼 연결
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);//배열에서
    gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 4*8, 0);//3개씩
    gl.vertexAttribPointer(aColLoc, 3, gl.FLOAT, false, 4*8, 4*3);//꺼내씀
    gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 4*8, 4*6);//꺼내씀
    gl.enableVertexAttribArray(aPosLoc);
    gl.enableVertexAttribArray(aColLoc);
    gl.enableVertexAttribArray(aTexLoc);
    //바닥 5
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, gl.texID5);
    var samplerLoc = gl.getUniformLocation(gl.program, 'u_texture');
    gl.uniform1i(samplerLoc, 4);
    gl.drawArrays(gl.TRIANGLE_FAN,0,4);
    //뒤왼오
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, gl.texID3);
    var samplerLoc = gl.getUniformLocation(gl.program, 'u_texture');
    gl.uniform1i(samplerLoc, 2);
    gl.drawArrays(gl.TRIANGLE_FAN,4,4);
    
    //뒤왼오
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gl.texID2);
    var samplerLoc = gl.getUniformLocation(gl.program, 'u_texture');
    gl.uniform1i(samplerLoc, 1);
    gl.drawArrays(gl.TRIANGLE_FAN,8,4);
    //뒤왼오
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, gl.texID4);
    var samplerLoc = gl.getUniformLocation(gl.program, 'u_texture');
    gl.uniform1i(samplerLoc, 3);
    gl.drawArrays(gl.TRIANGLE_FAN,12,4);
    
    //맵 생성
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, gl.texID6);
    var samplerLoc = gl.getUniformLocation(gl.program, 'u_texture');
    gl.uniform1i(samplerLoc, 5);
    if (newObjDrawingInfo === null && g_objDoc !== null)
    {
        newObjDrawingInfo = g_objDoc.getDrawingInfo();
        newObjDrawingInfo.vbo = gl.createBuffer();       
        gl.bindBuffer(gl.ARRAY_BUFFER, newObjDrawingInfo.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, newObjDrawingInfo.vertices, gl.STATIC_DRAW);                
        newObjDrawingInfo.veo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, newObjDrawingInfo.veo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, newObjDrawingInfo.indices, gl.STATIC_DRAW);        
    }
    if(newObjDrawingInfo !== null)
    {        
        gl.uniformMatrix4fv(aTransLoc, false, transMat.elements);
        gl.bindBuffer(gl.ARRAY_BUFFER, newObjDrawingInfo.vbo);
        gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPosLoc);
        gl.vertexAttrib3f(aColLoc, 1, 0.5, 0.65);
        gl.disableVertexAttribArray(aColLoc);
        gl.disableVertexAttribArray(aTexLoc);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, newObjDrawingInfo.veo);
        gl.drawElements(gl.TRIANGLES, newObjDrawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
    }    
    //돼지 생성
    if (newObjDrawingInfo2 === null && g_objDoc2 !== null)
    {
        newObjDrawingInfo2 = g_objDoc2.getDrawingInfo();
        newObjDrawingInfo2.vbo = gl.createBuffer();       
        gl.bindBuffer(gl.ARRAY_BUFFER, newObjDrawingInfo2.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, newObjDrawingInfo2.vertices, gl.STATIC_DRAW);                
        newObjDrawingInfo2.veo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, newObjDrawingInfo2.veo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, newObjDrawingInfo2.indices, gl.STATIC_DRAW);        
    }
    if(newObjDrawingInfo2 !== null)
    {        
        gl.uniformMatrix4fv(aTransLoc, false, transMat.elements);
        gl.bindBuffer(gl.ARRAY_BUFFER, newObjDrawingInfo2.vbo);
        gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPosLoc);
        gl.vertexAttrib3f(aColLoc, 0.1, 0.16, 0.16);
        gl.disableVertexAttribArray(aColLoc);
        gl.disableVertexAttribArray(aTexLoc);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, newObjDrawingInfo2.veo);
        gl.drawElements(gl.TRIANGLES, newObjDrawingInfo2.indices.length, gl.UNSIGNED_SHORT, 0);
    }    
    //늑대 생성  
    
    gl.bindBuffer(gl.ARRAY_BUFFER,box_buf);//버퍼 연결
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,box_buf_index);//버퍼 연결
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(boxpoints),gl.STATIC_DRAW);//배열에서
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint8Array(boxindexs),gl.STATIC_DRAW);//배열에서
    gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 4*8, 0);//3개씩
    gl.vertexAttribPointer(aColLoc, 3, gl.FLOAT, false, 4*8, 4*3);//꺼내씀
    gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 4*8, 4*6);//꺼내씀
    gl.enableVertexAttribArray(aPosLoc);
    gl.enableVertexAttribArray(aColLoc);
    gl.enableVertexAttribArray(aTexLoc);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.texID1);
    var samplerLoc = gl.getUniformLocation(gl.program, 'u_texture');
    gl.uniform1i(samplerLoc, 0);
    var depthResultIndexs=checkDepth();
    for(var i=0;i<boxcount;i++){
        gl.drawElements(gl.TRIANGLES,36,gl.UNSIGNED_BYTE,depthResultIndexs[i]*36);
    }
    //블럭생성  
    //gl.drawElements(gl.TRIANGLES,36*boxcount,gl.UNSIGNED_BYTE,0);
    //depthTest 이전
    gl_h.beginPath();
    gl_h.arc(600,400,3,0,2*Math.PI);
    gl_h.stroke();
    //에임 표시
    
    blockEle=document.getElementById('block');
    modeEle=document.getElementById('mode');
    durabilityEle=document.getElementById('durability');
    roundEle=document.getElementById('round');
    
    roundEle.innerHTML='스테이지: '+round+' 단계';
    blockEle.innerHTML='블록개수: '+(boxcount-deletecount)+'/ '+(boxlimit+1);
    if(boxmode===0){
        modeEle.innerHTML='모드: '+'생성';
        if((boxcount-deletecount)>boxlimit){
            modeEle.innerHTML='모드: '+'제한';
        }
    }
    else
        modeEle.innerHTML='모드: '+'삭제';
    durabilityEle.innerHTML='내구도 목표: '+durability+'/ '+(successCut+1);
}
function keydown(event){
    var sensitive;
    var a=viewAt.elements[0]-viewEye.elements[0];
    var b=viewAt.elements[2]-viewEye.elements[2];
    sensitive=(Math.abs(a)+Math.abs(b))*100;
    var tick_count=0;
    var tick_max=10;
    var tick_stop=0;
    if(event.keyCode===87){//87=w
        var Wtick=function(){
            viewEye.elements[2]+=b/sensitive;
            viewEye.elements[0]+=a/sensitive;
            viewAt.elements[2]+=b/sensitive;
            viewAt.elements[0]+=a/sensitive;
            if(tick_count<5){
                viewEye.elements[1]+=0.01/sensitive;
                viewAt.elements[1]+=0.01/sensitive;
            }
            else{
                viewEye.elements[1]-=0.01/sensitive;
                viewAt.elements[1]-=0.01/sensitive;    
            }
            tick_count++;//틱 횟수
            draw();
            if(tick_count<tick_max){//틱 횟수 제한
                
                requestAnimationFrame(Wtick);
            }
            else{//제한에 도달하면
                tick_count=0;//초기화
                tick_stop=1;//tick 제어
                if(downCheck()===1){
                    down();
                }
            }
        };
        if(tick_stop===0){
        Wtick();
        }
    }
    else if(event.keyCode===65){//65=a
        var Atick=function(){
            viewEye.elements[2]-=a/sensitive;
            viewEye.elements[0]+=b/sensitive;
            viewAt.elements[2]-=a/sensitive;
            viewAt.elements[0]+=b/sensitive;
            if(tick_count<5){
                viewEye.elements[1]+=0.01/sensitive;
                viewAt.elements[1]+=0.01/sensitive;
            }
            else{
                viewEye.elements[1]-=0.01/sensitive;
                viewAt.elements[1]-=0.01/sensitive;    
            }
            tick_count++;
            draw();
            if(tick_count<tick_max){
                requestAnimationFrame(Atick);
            }
            else{
                tick_count=0;
                tick_stop=1;
                if(downCheck()===1){
                    down();
                }
            }
        };
        if(tick_stop===0){
        Atick();
        }
    }
    else if(event.keyCode===83){//83=s
        var Stick=function(){
            viewEye.elements[2]-=b/sensitive;
            viewEye.elements[0]-=a/sensitive;
            viewAt.elements[2]-=b/sensitive;
            viewAt.elements[0]-=a/sensitive;
            if(tick_count<5){
                viewEye.elements[1]+=0.01/sensitive;
                viewAt.elements[1]+=0.01/sensitive;
            }
            else{
                viewEye.elements[1]-=0.01/sensitive;
                viewAt.elements[1]-=0.01/sensitive;    
            }
            tick_count++;
            draw();
            if(tick_count<tick_max){
                requestAnimationFrame(Stick);
            }
            else{
                tick_count=0;
                tick_stop=1;
                if(downCheck()===1){
                    down();
                }
            }
        };
        if(tick_stop===0){
        Stick();
        }
    }
    else if(event.keyCode===68){//68=d
        var Dtick=function(){
            viewEye.elements[2]+=a/sensitive;
            viewEye.elements[0]-=b/sensitive;
            viewAt.elements[2]+=a/sensitive;
            viewAt.elements[0]-=b/sensitive;
            if(tick_count<5){
                viewEye.elements[1]+=0.01/sensitive;
                viewAt.elements[1]+=0.01/sensitive;
            }
            else{
                viewEye.elements[1]-=0.01/sensitive;
                viewAt.elements[1]-=0.01/sensitive;    
            }
            tick_count++;
            draw();
            if(tick_count<tick_max){
                requestAnimationFrame(Dtick);
            }
            else{
                tick_count=0;
                tick_stop=1;
                if(downCheck()===1){
                    down();
                }
            }
        };
        if(tick_stop===0){
        Dtick();
        }
    }
    else if(event.keyCode===38){
        var Uptick=function(){
        viewAt.elements[1]+=0.001;
        tick_count++;
            draw();
            if(tick_count<tick_max){
                requestAnimationFrame(Uptick);
            }
            else{
                tick_count=0;
                tick_stop=1;
            }
        };
        if(tick_stop===0){
        Uptick();
        }
    }
    else if(event.keyCode===40){
    var Downtick=function(){
        viewAt.elements[1]-=0.001;
        tick_count++;
            draw();
            if(tick_count<tick_max){
                requestAnimationFrame(Downtick);
            }
            else{
                tick_count=0;
                tick_stop=1;
            }
        };
        if(tick_stop===0){
        Downtick();
        }
    }
    else if(event.keyCode===37){//<-
        var Ltick=function(){
            turn(-1);
        tick_count++;
            if(tick_count<tick_max){
                requestAnimationFrame(Ltick);
            }
            else{
                tick_count=0;
                tick_stop=1;
            }
        };
        if(tick_stop===0){
        Ltick();
        }
    }    
    else if(event.keyCode===39){//->    
        var Rtick=function(){
            turn(1);
        tick_count++;
            if(tick_count<tick_max){
                requestAnimationFrame(Rtick);
            }
            else{
                tick_count=0;
                tick_stop=1;
            }
        };
        if(tick_stop===0){
        Rtick();
        }
    }   
    else if(event.keyCode===32){//점프
        jump();
    }
    else if(event.keyCode===80){//p
        clicked();
    }
    else if(event.keyCode===86){//v
        changeView();
    }
    else if(event.keyCode===77){//m
        if(boxmode===0)
            boxmode=1;
        else
            boxmode=0;
    }
    draw();
}
function down(){
    var down_count=0;
    var downtick=function(){
        viewEye.elements[1]-=0.01;
        viewAt.elements[1]-=0.01;
        down_count+=1;
        draw();
        if(down_count!==10){
            requestAnimationFrame(downtick);
        }   
    };
    downtick();
}//-0.1만큼 하강
function jump(){//점프
    var jump_count=0;//10번에걸쳐 올라가고 10번에 걸쳐 내려옴
    var limit=0;//올라가고 내려오는 동작 구분하기위해
    var jumptick=function(){
        if(limit===0){//올라갈수있을때
            viewEye.elements[1]+=0.01;
            viewAt.elements[1]+=0.01;//올리고
            jump_count+=1;//올린횟수+
            draw();//그려주고
            if(jump_count===10){//10번 반복됬으면 이제 그만
                var ex_floorbox=floorbox;//내가 밟고있던 블럭 위에서
                limit=floorCheck();
                if(ex_floorbox===floorbox){//또 점프했으면
                    limit=1;//더이상 상승하지 않고 평범한 점프를 한다
                }
                if(limit===2){
                    floorcount+=1;
                }
            }
        }
        if(limit===1){//내려온다 (올라갈때와 비슷 동작)
            viewEye.elements[1]-=0.01;
            viewAt.elements[1]-=0.01;
            jump_count+=1;
            draw();
            if(jump_count===20){
                limit=2;
            }
        }
        if(limit!==2){
            requestAnimationFrame(jumptick);
        }
    };
    jumptick();
}//0.1만큼 상승 후 하강
function clicked(){
    clicked_x=((-viewEye.elements[1])/
            (viewAt.elements[1]-viewEye.elements[1])*
            (viewAt.elements[0]-viewEye.elements[0])+
            viewEye.elements[0]);
    clicked_z=((-viewEye.elements[1])/
            (viewAt.elements[1]-viewEye.elements[1])*
            (viewAt.elements[2]-viewEye.elements[2])+
            viewEye.elements[2]);
    if(boxmode===0){
        if((boxcount-deletecount)<=boxlimit){
            create();
        }        
    }
    else
        erase();
    draw();
}
function moved(event) {
	var posx = 0;
	var posy = 0;
	if (!e) var e = window.event;
	if (e.pageX || e.pageY){
            posx = e.pageX;
            posy = e.pageY;
	}
	else if (e.clientX || e.clientY){
            posx = e.clientX + document.body.scrollLeft+
                    document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop+
                    document.documentElement.scrollTop;
	}
        var rect=event.target.getBoundingClientRect();
        posx=(2.0*(posx-rect.left)/map.width-1.0);
        posy=(1.0-2.0*(posy-rect.top)/map.height);
        rotateVec.elements[0]=viewAt.elements[0]-viewEye.elements[0];
        rotateVec.elements[1]=viewAt.elements[1]-viewEye.elements[1];
        rotateVec.elements[2]=viewAt.elements[2]-viewEye.elements[2];
        rotateVec.elements[3]=1;
        if(((posx-ex_posx)!==0)&&((posy-ex_posy)!==0)){
        transMat.rotate(Math.sqrt((posy-ex_posy)*(posy-ex_posy)+(posx-ex_posx)*(posx-ex_posx)),
                                -(posy-ex_posy),(posx-ex_posx),0);
        var etrans=transMat.elements;
        viewAt.elements[0]=etrans[0]*rotateVec.elements[0]+etrans[1]*rotateVec.elements[1]+
                etrans[2]*rotateVec.elements[2]+etrans[3]*rotateVec.elements[3]+viewEye.elements[0];
        viewAt.elements[1]=etrans[4]*rotateVec.elements[0]+etrans[5]*rotateVec.elements[1]+
                etrans[6]*rotateVec.elements[2]+etrans[7]*rotateVec.elements[3]+viewEye.elements[1];
        viewAt.elements[2]=etrans[8]*rotateVec.elements[0]+etrans[9]*rotateVec.elements[1]+
                etrans[10]*rotateVec.elements[2]+etrans[11]*rotateVec.elements[3]+viewEye.elements[2];
        draw();
        ex_posx=posx;
        ex_posy=posy;
    }
}
function floorCheck(){
    for(var i=0;i<boxcount;i++){//박스중
        if((boxpoints[i*64+0]<=viewEye.elements[0])&&(boxpoints[i*64+2]>=viewEye.elements[2])){
            if((boxpoints[i*64+16]>=viewEye.elements[0])&&(boxpoints[i*64+18]<=viewEye.elements[2])){
                //내가 밟고있는박스가 뭔지
                floorbox=i;//알려주고
                //리턴값은 점프에만 쓰인다
                return 2;//올라간다(점프를 최고점에서 멈춘다)
            }
        }
    }
    return 1;//내려온다(점프 계속 진행)
}//어떤 블록을 밟고 있는지 체크
function downCheck(){
    if(floorcount>0){//밑에 블럭이있을때
        if((boxpoints[floorbox*64+0]>viewEye.elements[0])||
            (boxpoints[floorbox*64+2]<viewEye.elements[2])||
            (boxpoints[floorbox*64+16]<viewEye.elements[0])||
            (boxpoints[floorbox*64+18]>viewEye.elements[2])){
        //블럭의 범위를 벗어나면
            floorcount-=1;//떨어진다
            floorCheck();
            return 1;
        }        
    }  
    if(floorcount===0){
        floorbox=null;
    }
}//블록을 벗어났는지 체크
function erase(){
    for(var i=0;i<boxcount;i++){
        if((boxpoints[i*64+0]<=clicked_x)&&(boxpoints[i*64+2]>=clicked_z)){//좌표
            if((boxpoints[i*64+16]>=clicked_x)&&(boxpoints[i*64+18]<=clicked_z)){
                for(var j=0;j<64;j++){
                    boxpoints[i*64+j]=0;
                }
                deletecount+=1;
                draw();
            }
        }
    }
}
function create(){
    boxpoints.push(clicked_x);
    boxpoints.push(0);
    boxpoints.push(clicked_z);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(0);
    boxpoints.push(0);
    //0
    boxpoints.push(clicked_x);
    boxpoints.push(0);
    boxpoints.push(clicked_z-0.1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(0);
    //1
    boxpoints.push(clicked_x+0.1);
    boxpoints.push(0);
    boxpoints.push(clicked_z-0.1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(0);
    boxpoints.push(0);
    //2
    boxpoints.push(clicked_x+0.1);
    boxpoints.push(0);
    boxpoints.push(clicked_z);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(0);
    //3
    boxpoints.push(clicked_x);
    boxpoints.push(0.1);
    boxpoints.push(clicked_z);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(0);
    boxpoints.push(1);
    //4
    boxpoints.push(clicked_x);
    boxpoints.push(0.1);
    boxpoints.push(clicked_z-0.1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    //5
    boxpoints.push(clicked_x+0.1);
    boxpoints.push(0.1);
    boxpoints.push(clicked_z-0.1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(0);
    boxpoints.push(1);
    //6
    boxpoints.push(clicked_x+0.1);
    boxpoints.push(0.1);
    boxpoints.push(clicked_z);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    boxpoints.push(1);
    //7
    boxindexs.push(8*boxcount);
    boxindexs.push(8*boxcount+1);
    boxindexs.push(8*boxcount+2);//
    boxindexs.push(8*boxcount);
    boxindexs.push(8*boxcount+3);
    boxindexs.push(8*boxcount+2);//
    boxindexs.push(8*boxcount+4);
    boxindexs.push(8*boxcount+5);
    boxindexs.push(8*boxcount+6);//
    boxindexs.push(8*boxcount+4);
    boxindexs.push(8*boxcount+7);
    boxindexs.push(8*boxcount+6);//
    boxindexs.push(8*boxcount+1);
    boxindexs.push(8*boxcount+5);
    boxindexs.push(8*boxcount+6);//
    boxindexs.push(8*boxcount+1);
    boxindexs.push(8*boxcount+2);
    boxindexs.push(8*boxcount+6);//
    boxindexs.push(8*boxcount);
    boxindexs.push(8*boxcount+4);
    boxindexs.push(8*boxcount+5);//
    boxindexs.push(8*boxcount);
    boxindexs.push(8*boxcount+1);
    boxindexs.push(8*boxcount+5);//
    boxindexs.push(8*boxcount+3);
    boxindexs.push(8*boxcount+7);
    boxindexs.push(8*boxcount+6);//
    boxindexs.push(8*boxcount+3);
    boxindexs.push(8*boxcount+2);
    boxindexs.push(8*boxcount+6);//
    boxindexs.push(8*boxcount+0);
    boxindexs.push(8*boxcount+4);
    boxindexs.push(8*boxcount+7);//
    boxindexs.push(8*boxcount+0);
    boxindexs.push(8*boxcount+3);
    boxindexs.push(8*boxcount+7);//
    boxcount++;
}
function loadAudio(url){
        var request=new XMLHttpRequest();
        request.open('GET',url,true);
        request.responseType='arraybuffer';
        
        request.onload=function(){
            audio_context.decodeAudioData(request.response,function(buffer){
                audio_buf=buffer;
            playSound(audio_context,audio_buf);
        },function(e){console.log("error");});            
        };
        request.send();
}
function playSound(context,buffer){
    var source=context.createBufferSource();
    source.buffer=buffer;
    source.connect(context.destination);
    source.start(0);
}
function turn(direction){
    rotateVec.elements[0]=viewAt.elements[0]-viewEye.elements[0];
    rotateVec.elements[1]=viewAt.elements[1]-viewEye.elements[1];
    rotateVec.elements[2]=viewAt.elements[2]-viewEye.elements[2];
    rotateVec.elements[3]=1;

    transMat.rotate(0.7,0,direction,0);
    var etrans=transMat.elements;
    viewAt.elements[0]=etrans[0]*rotateVec.elements[0]+etrans[1]*rotateVec.elements[1]+
            etrans[2]*rotateVec.elements[2]+etrans[3]*rotateVec.elements[3]+viewEye.elements[0];
    viewAt.elements[1]=etrans[4]*rotateVec.elements[0]+etrans[5]*rotateVec.elements[1]+
            etrans[6]*rotateVec.elements[2]+etrans[7]*rotateVec.elements[3]+viewEye.elements[1];
    viewAt.elements[2]=etrans[8]*rotateVec.elements[0]+etrans[9]*rotateVec.elements[1]+
            etrans[10]*rotateVec.elements[2]+etrans[11]*rotateVec.elements[3]+viewEye.elements[2];
    transMat.rotate(0.7,0,-direction,0);
    draw();
}
function changeView(){
    if(startmode===0){
    ex_viewEye.elements[0]=viewEye.elements[0];
    ex_viewEye.elements[1]=viewEye.elements[1];
    ex_viewEye.elements[2]=viewEye.elements[2];
    ex_viewAt.elements[0]=viewAt.elements[0];
    ex_viewAt.elements[1]=viewAt.elements[1];
    ex_viewAt.elements[2]=viewAt.elements[2];
    //0,0.6,2
    //0,0.05,0.05
    var dif_Eyex=0-viewEye.elements[0];
    var dif_Eyey=0.6-viewEye.elements[1];
    var dif_Eyez=2-viewEye.elements[2];
    var dif_Atx=0-viewAt.elements[0];
    var dif_Aty=0.05-viewAt.elements[1];
    var dif_Atz=0.05-viewAt.elements[2];
    var sensitive=150;
    var tick_count=0;
    var tick_max=sensitive;
    var tick_stop=0;
    var changeViewToStarttick=function(){
        viewEye.elements[0]+=dif_Eyex/sensitive;
        viewEye.elements[1]+=dif_Eyey/sensitive;
        viewEye.elements[2]+=dif_Eyez/sensitive;
        viewAt.elements[0]+=dif_Atx/sensitive;
        viewAt.elements[1]+=dif_Aty/sensitive;
        viewAt.elements[2]+=dif_Atz/sensitive;
        tick_count++;
        draw();
        if(tick_count<tick_max){
            requestAnimationFrame(changeViewToStarttick);
        }
        else{
            tick_count=0;
            tick_stop=1;
        }
        if(tick_stop===1){
           startGame();
        }
    };
    if(tick_stop===0){
        changeViewToStarttick();
    }
    startmode=1;
    }
    else{
    //0,0.6,2
    //0,0.05,0.05
    var dif_Eyex=ex_viewEye.elements[0]-0;
    var dif_Eyey=ex_viewEye.elements[1]-0.6;
    var dif_Eyez=ex_viewEye.elements[2]-2;
    var dif_Atx=ex_viewAt.elements[0]-0;
    var dif_Aty=ex_viewAt.elements[1]-0.05;
    var dif_Atz=ex_viewAt.elements[2]-0.05;
    var sensitive=150;
    var tick_count=0;
    var tick_max=sensitive;
    var tick_stop=0;
    
    var changeViewToReadytick=function(){
        viewEye.elements[0]+=dif_Eyex/sensitive;
        viewEye.elements[1]+=dif_Eyey/sensitive;
        viewEye.elements[2]+=dif_Eyez/sensitive;
        viewAt.elements[0]+=dif_Atx/sensitive;
        viewAt.elements[1]+=dif_Aty/sensitive;
        viewAt.elements[2]+=dif_Atz/sensitive;
        tick_count++;
        draw();
        if(tick_count<tick_max){
            requestAnimationFrame(changeViewToReadytick);
        }
        else{
            tick_count=0;
            tick_stop=1;
        }
    };
    if(tick_stop===0){
        changeViewToReadytick();
    }
    startmode=0;
    }
}
function startGame(){
    durability=0;
    console.log("stratGame called");
    for(var i=0;i<boxcount;i++){
        if((boxpoints[i*64+0]<=0.45)&&(boxpoints[i*64+0]>=-0.55)){//좌표
            if((boxpoints[i*64+2]<=0.15)&&(boxpoints[i*64+2]>=-0.05)){
                if(boxpoints[i*64+0]!==0&&boxpoints[i*64+2]!==0){
                    durability+=1;
                    draw();
                }
            }
        }
    }
    draw();
    checkSuccess();
}
function checkSuccess(){
    if(durability>successCut){//success
        success();
    }
    else{
        //fail
    }
}
var round=1;
function success(){
    viewEye=new Vector3([0,0.05,0.15]);//[0,0.05,0.15]//[0,0.6,2]
    viewAt=new Vector3([0.0,0.05,0.05]);//[0.0,0.05,0.05]
    for(var i=0;i<boxcount;i++){
        for(var j=0;j<64;j++){
            boxpoints.pop();
        }
    }
    for(var i=0;i<boxcount;i++){
        for(var j=0;j<36;j++){
            boxindexs.pop();
        }
    }
    boxcount=0;//만든 박스의 개수
    deletecount=0;
    floorcount=0;//밑에있는 블럭의 개수
    floorbox=null;//밟고 있는 박스의 인덱스값
    durability=0;
    boxlimit-=2;//재료 제한(생성 가능 박스 수 제한)
    successCut+=1;//성공제한
    boxmode=0;
    startmode=0;
    round+=1;
    if(round<=3){
        confirm("돼지를 구해냈어요! \n"+
                "다음단계로 이동합니다! ");
    }
    else{//3라운드 넘어감
        confirm("게임에 승리하셨습니다! \n"+
                "축하드립니다! ");    
    }
    draw();
}
function checkDepth(){
    var depthResult=new Array();
    var depthResultIndexs=new Array();
    for(var i=0;i<boxcount;i++){
        depthResultIndexs.push(i);
        depthResult.push(Math.pow((viewEye.elements[0]-(boxpoints[i*64+0]+0.05)),2)+
                Math.pow((viewEye.elements[2]-(boxpoints[i*64+2]-0.05)),2));
    }
    for(var i=0;i<boxcount;i++){
        for(var j=i+1;j<boxcount;j++){
            if(depthResult[i]<depthResult[j]){
                var temp=depthResult[i];
                depthResult[i]=depthResult[j];
                depthResult[j]=temp;
                temp=depthResultIndexs[i];
                depthResultIndexs[i]=depthResultIndexs[j];
                depthResultIndexs[j]=temp;
            }
        }
    }//0~크기순 sort
    return depthResultIndexs;
}