FROM botpress/server:v12_9_1

COPY ./models /botpress/emb

WORKDIR /botpress/emb

RUN wget -O bp.uk.300.bin.gz https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.uk.300.bin.gz
RUN gunzip bp.uk.300.bin.gz

WORKDIR /botpress