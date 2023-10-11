#!/bin/bash

# ./docker-build.sh tag_image

tag_image=$1
if [ -z $1 ]; then
    echo "Chua nhap tham so, gia tri se de mac dinh tag:latest"
    tag_image=latest
fi

# build image
docker build -f docker/Dockerfile -t registry.ctisoftware.vn/federation:"$tag_image" .

node script/change-version-after-build-docker-image.js $tag_image
# shellcheck disable=SC2046
# docker rmi -f $(docker images -f dangling=true -q)