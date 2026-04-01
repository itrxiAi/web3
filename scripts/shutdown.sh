#!/bin/bash

# 先清理旧进程
pm2 delete ava-points 2>/dev/null || true