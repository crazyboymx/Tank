/**    
 * CODETANK 
 * Copyright (c) 2012, Tencent AlloyTeam, All rights reserved.
 * http://CodeTank.AlloyTeam.com/
 *
 * @version     1.0
 * @author      AlloyTeam
 *
 *  .d8888b.                888      88888888888               888   TM   
 * d88P  Y88b               888      ''''888''''               888      
 * 888    888               888          888                   888      
 * 888         .d88b.   .d88888  .d88b.  888  8888b.  88888b.  888  888 
 * 888        d88""88b d88" 888 d8P  Y8b 888     "88b 888 "88b 888 .88P 
 * 888    888 888  888 888  888 88888888 888 .d888888 888  888 888888K  
 * Y88b  d88P Y88..88P Y88b 888 Y8b.     888 888  888 888  888 888 "88b 
 *  "Y8888P"   "Y88P"   "Y88888  "Y8888  888 "Y888888 888  888 888  888 
 * 
 */

Jx().$package(function(J){
    var maxEnergy = 3;
    var smartTurn = function(angle) {
        if (angle > 180) {
            angle = angle - 360;
        }
        else if (angle < -180) {
            angle = angle + 360;
        }
        return angle;
    };
    var getGunAngleToTurn = function(angleGunToTurn) {
        return (angleGunToTurn + this.getHeading() - this.getGunHeading()) % 360;
    };
    var smartFireStrangth = function(energy, distance) {
        var str = energy < 5*3 ? energy/5 : 3;
    	if (distance > 200) {
			str /= 3;
		}
        else if (distance > 150) {
			str /= 2;
		}
        else if (distance > 100) {
			str /= 1.5;
		}
		return str;
    };
    //弧度转角度
    var r2a = function (radian){
        return (radian*180.0/Math.PI);
    }
    //角度转弧度
    var a2r = function (angle){
        return (angle/180.0*Math.PI);
    }
    var getDist = function(pos1, pos2) {
        return Math.sqrt((pos1[0]-pos2[0])*(pos1[0]-pos2[0])+(pos1[1]-pos2[1])*(pos1[1]-pos2[1]));
    };
    // 计算一个向量的角度
    var getVecAngle = function(vec) {
        if (vec[0] == 0 && vec[1] == 0) {
            return 0;
        }
        var len = Math.sqrt(vec[0]*vec[0]+vec[1]*vec[1]);
        if (vec[1] > 0) {
            return 360-Math.acos(vec[0]/len)/Math.PI*180;
        }
        else if (vec[1] < 0) {
            return Math.acos(vec[0]/len)/Math.PI*180;
        }
        else {
            return vec[0] > 0 ? 0 : 180;
        }
    };
    // 计算tank转到pos点需要转动的角度 范围[0,180]
    var getTurnAngle = function(obj, pos) {
        var tankPos = obj.getPos();
        var angToPos = getVecAngle([pos[0]-tankPos[0],pos[1]-tankPos[1]]);
        return smartTurn(obj.getHeading()-angToPos);
    };
    // 计算从一个点出发，angle方向，dist距离的点坐标
    var calcPos = function(oriPos, angle, dist) {
        angle = angle*Math.PI/180;
        var newPos = [dist*Math.cos(angle)+oriPos[0], -dist*Math.sin(angle)+oriPos[1]];
        //alert("oriPos:"+oriPos.toString()+",angle: "+angle+",dist: "+dist+"new Pos: "+newPos.toString());
        return newPos;
    };
    // 根据位置，朝向，运动方向和旋转方向，计算圆周运动的圆心位置
    var calcCenter = function(pos, angle, dir, turnDir, radius) {
        angle = turnDir > 0 ? angle-90*dir : angle+90*dir;
        return calcPos(pos, angle, radius);
    };
    // angle：圆周运动转动的角度
    // 从pos点出发，绕center为圆心，r为半径做圆周运动，运动angle角度，计算最终的位置。
    var calcCycleMotionPos = function(pos, angle, r, center) {
        var fa = getVecAngle([pos[0]-center[0], pos[1]-center[1]]) - angle;
        return calcPos(center, fa, r);
    };
    var Rect = function(top, left, width, height) {
        this.top = top || 0;
        this.left = left || 0;
        this.width = width || 0;
        this.height = height || 0;
    };
    Rect.prototype = {
        inRect: function(point) {
            return point[0] > this.left && point[0] < this.left+this.width && point[1] > this.top && point[1] < this.top+this.height;
        }
    };
    var distTol = 0.01;
    var AI = {
        common  : 0
    };
    var currAI = AI.common;
    var CommonAI = function() {
    };
    CommonAI.prototype = {
        init: function(self) {
            this.tank = self;
            this.arena = this.arena || {};
            this.arena.w = self.getBattleFieldWidth();
            this.arena.h = self.getBattleFieldHeight();
            this.arena.center = [this.arena.w/2, this.arena.h/2];
            this.enemy = this.enemy || {};
            this.size = self.getSize();
            //this.r = this.tank.moveSpeed / this.tank.turnSpeed;
            this.r = 8 / 6/180.0*Math.PI;
            this.validArena = new Rect(this.size[0]*0.8, this.size[1]*0.8, this.arena.w-this.size[0]*1.6, this.arena.h-this.size[0]*1.6);
            this.bulletSpeed = 12;
            this.stepLengthBase = this.size[1];
            this.stepLengthScale = 3;
            this.stepLengthDelta = this.stepLengthBase;
            this.turnBase = 24;
            this.turnScale = 3;
            this.turnDelta = this.turnBase / 2;
            this.dir = 1;
            this.dirContCnt = 0;
            self.setAdjustGunForRobotTurn(true);
            this.nextTurnAngle = 0;
            
            this.lastScanedTime = 0;
            this.lastScanedTank = '';
        },
        // 更新敌人信息e:ScannedRobotEvent
        updateEnemy: function(e) {
            self = this.tank;
            var name = e.getName();
            if (!this.enemy[name]) {
                this.enemy[name] = {};
            }
            this.enemy[name].bearing = e.getBearing();
            this.enemy[name].distance = e.getDistance();
            this.enemy[name].energy = e.getEnergy();
            this.enemy[name].heading = e.getHeading();
            this.enemy[name].speed = e.getSpeed();
            this.enemy[name].lastScanedPos = this.enemy[name].pos;
            this.enemy[name].lastScanedTime = (new Date()).getTime();
            this.enemy[name].pos = calcPos(self.getPos(), self.getHeading()+this.enemy[name].bearing, this.enemy[name].distance);
            this.lastScanedTime = this.enemy[name].lastScanedTime;
            this.lastScanedTank = name;
        },
        optimalTurnAngle: function() {
            // 如果是0.1秒之前看到的，重新扫描
            if (((new Date()).getTime()-this.lastScanedTime) >= 100) {
                var ram = Math.random();
                var dir = ram > 0.5 ? 1 : -1;
                this.nextTurnAngle = smartTurn(ram*this.turnBase*this.turnScale+this.turnDelta)*dir;
            }
            else { // 否则相对他做圆周运动
                this.tank.say("我转死你~~");
                var pos = this.tank.getPos();
                var ePos = this.enemy[this.lastScanedTank].pos;
                this.nextTurnAngle = smartTurn(this.tank.getHeading()-(getVecAngle([ePos[0]-pos[0], ePos[1]-pos[1]])+90));
                if (Math.abs(this.nextTurnAngle) < 10) {
                    this.nextTurnAngle = this.nextTurnAngle > 0 ? 10 : -10;
                }
            }
            return 19;
        },
        optimalDirection: function() {
            var ram = Math.random();
            if (this.dirContCnt > ram*3+2) {
                this.reversion();
            }
            else {
                this.dirContCnt += 1;
            }
            if (this.willCollision()) {
                this.tank.say("靠，要撞墙啦，我转~~", "#00ff00");
                this.reversion();
            }
        },
        predictEnemyPos: function(enmy, interval) {
            var et = this.enemy[enmy];
            var pos = new Array(2);
            pos[0] = (et.pos[0] + interval*et.speed*Math.cos(a2r(et.heading)));
            pos[1] = (et.pos[1] + interval*et.speed*Math.sin(a2r(et.heading)));
            return pos;
        },
        predictMyPos: function(interval) {
            var self = this.tank;
            var currPos = self.getPos();
            var heading = self.getHeading();
            var center = calcCenter(currPos, heading, this.dir, this.nextTurnAngle, this.r);
            return calcCycleMotionPos(currPos, interval*self.turnSpeed, this.r, center);
        },
        // 预测子弹射中enmy需要的时间
        predictHitTime: function(enmy) {
            var et = this.enemy[enmy];
            var selfPos = this.tank.getPos();
            var vec = getVecAngle([et.pos[0]-selfPos[0], et.pos[1]-selfPos[1]]);
            //alert("dist: "+getDist(et.pos, selfPos));
            //var s = this.bulletSpeed+et.speed*Math.cos(et.heading-vec);
            //alert("speed:"+s);
            return getDist(et.pos, selfPos) / this.bulletSpeed+et.speed*Math.cos(et.heading-vec);
        },
        // 设置炮口对准目标tank，返回需要调整的角度
        aimTo: function(enmy) {
            et = this.enemy[enmy];
            var t = this.predictHitTime(enmy);
            //alert('hit time: '+t);
            var myPPos = this.tank.getPos();
            //alert("myPPos: "+myPPos.toString());
            var etPPos = this.predictEnemyPos(enmy, t);
            //alert("etPPos:"+etPPos.toString());
            var fAngle = getVecAngle([etPPos[0]-myPPos[0], etPPos[1]-myPPos[1]]);
            return smartTurn(fAngle-this.tank.getGunHeading());
        },
        willCollision: function() {
            self = this.tank;
            var pos = self.getPos();
            var heading = self.getHeading();
            var center = calcCenter(pos, heading, this.dir, this.nextTurnAngle, this.r);
            var nextPos = calcCycleMotionPos(pos, this.nextTurnAngle, this.r, center);
            var dectPos = [nextPos[0],nextPos[1]];
            // x方向上跨过圆心，则默认y方向不会跨过圆心
            if ((pos[0]<center[0] && center[0]<nextPos[0]) || (pos[0]>center[0] && center[0]>nextPos[0])) {
                if (pos[1] > center[1]) {
                    dectPos[1] = center[1]+this.r;
                }
                else {
                    dectPos[1] = center[1]-this.r;
                }
            }
            // y方向上跨过圆心，则默认x方向不会跨过圆心
            if ((pos[1]<center[1] && center[1]<nextPos[1]) || (pos[1]>center[1] && center[1]>nextPos[1])) {
                if (pos[0] > center[0]) {
                    dectPos[0] = center[0]+this.r;
                }
                else {
                    dectPos[0] = center[0]-this.r;
                }
            }
            if (!this.validArena.inRect(dectPos)) {
                return true;
            }
            /*for (var p in this.enemy) {
                if (!this.enemy.hasOwnProperty(p)) {
                    continue;
                }
                // 如果是0.1秒之前看到的并且新位置距离小于size，则会碰撞
                if (((new Date()).getTime()-this.enemy[p].lastScenedTime) < 0.1 && getDist(pos, this.enemy[p].pos) < this.size[0]) {
                    return true;
                }
            }*/
            return false;
        },
        reversion: function() {
            this.dir = -this.dir;
            this.dirContCnt = 0;
        },
        step: function() {
            self = this.tank;
            this.optimalTurnAngle();
            this.optimalDirection();
            self.setTurn(this.nextTurnAngle, this.step.bind(this));
            self.setGunTurnRight(1000*this);
            self.setAhead(10000*this.dir);
            self.execute();
        },
        willFire: function() {
            
        },
        trackEnemy: function() {
            
        }
    };
    
    var aiPool = [
        new CommonAI()
    ];
    
    Robot = new J.Class({extend : tank.Robot}, {
		/**
		*robot主循环
		**/	
		run:function(){
			this.setUI(tank.ui["grey"]);
            aiPool[currAI].init(this);
            this.loop(function() {
                aiPool[currAI].step();
            });
		},

		/**
		*看到其他robot的处理程序
		**/
		onScannedRobot:function(e){
			aiPool[currAI].updateEnemy(e);
            this.turnGun(aiPool[currAI].aimTo(e.getName()));
            if (this.getGunHeat() == 0) {
                this.fire(smartFireStrangth(this.getEnergy(), e.getDistance()));
            }
            aiPool[currAI].trackEnemy();
            this.scan();
            return;
            var angleToRobot=e.getBearing();
            var angleGunToTurn=getGunAngleToTurn.call(this,angleToRobot);
            var angleToTurn=smartTurn(angleGunToTurn);
            
			// If it's close enough, fire!
			if (Math.abs(angleToTurn) <= 3) {
                //this.stopMove();
                this.turnGunLeft(angleToTurn);
				// We check gun heat here, because calling fire()
				// uses a turn, which could cause us to lose track
				// of the other robot.
				if (this.getGunHeat() == 0) {
					this.fire(Math.min(3 - Math.abs(angleToTurn), this.getEnergy() - 0.1));
				}
			} // otherwise just set the gun to turn.
			else {
                //this.stopMove();
				this.turnGunLeft(angleToTurn);
			}
			this.scan();
		},

		/**
		*被子弹击中的处理程序
		**/
		onHitByBullet:function(e){
			//this.energy = 100;
		},

		/**
		*和墙碰撞的处理程序
		**/
		onHitWall:function(e){
			this.say("nnd,还是撞墙了！！！", "#ff0000");
		},

		onRobotDeath:function(e){
			
		}
	});
});