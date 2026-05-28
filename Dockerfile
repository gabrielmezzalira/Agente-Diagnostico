FROM python:3.11
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --upgrade pip \
        --index-url https://pypi.org/simple/ \
        --trusted-host pypi.org \
        --trusted-host files.pythonhosted.org && \
    pip install --no-cache-dir \
        --index-url https://pypi.org/simple/ \
        --trusted-host pypi.org \
        --trusted-host files.pythonhosted.org \
        -r requirements.txt
COPY backend/ ./backend/
WORKDIR /app/backend
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
