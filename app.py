from flask import Flask, render_template, send_from_directory

# 指定 static_folder & template_folder
app = Flask(__name__, static_folder="static", template_folder="templates")

@app.route("/")
def index():
    return render_template("index.html")

# 保证 service-worker.js 能正确加载
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
