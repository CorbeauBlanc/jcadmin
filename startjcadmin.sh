#!/bin/bash
cd /home/pi/jcadmin

node jcadmin.js 8080 /home/pi/jcblock | tee -a jcadmin.log