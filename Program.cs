using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace FunctionalEarTrainer
{
    internal static class Program
    {
        [STAThread]
        static void Main()
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new MainForm());
        }
    }

    public class MainForm : Form
    {
        private readonly WebView2 _webView;

        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        public MainForm()
        {
            Text = "Functional Ear Trainer Studio";
            Width = 1360;
            Height = 860;
            MinimumSize = new Size(1024, 700);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(11, 15, 25);

            // Enable Windows 11/10 native Dark Mode titlebar
            try
            {
                int useDarkMode = 1;
                DwmSetWindowAttribute(Handle, 20, ref useDarkMode, sizeof(int));
            }
            catch
            {
                // Ignore on older Windows versions
            }

            _webView = new WebView2
            {
                Dock = DockStyle.Fill,
                DefaultBackgroundColor = Color.FromArgb(11, 15, 25)
            };

            Controls.Add(_webView);
            Load += OnFormLoad;
        }

        private async void OnFormLoad(object? sender, EventArgs e)
        {
            try
            {
                string userDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "FunctionalEarTrainerStudio"
                );
                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await _webView.EnsureCoreWebView2Async(env);

                _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
                _webView.CoreWebView2.AddHostObjectToScript("nativeFile", new NativeFileSaver());

                string appDir = FindAppFolder();
                _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "ear.studio",
                    appDir,
                    CoreWebView2HostResourceAccessKind.Allow
                );

                _webView.CoreWebView2.Navigate("https://ear.studio/index.html");
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Failed to initialize WebView2 runtime: " + ex.Message,
                    "Functional Ear Trainer Studio",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private static string FindAppFolder()
        {
            string baseDir = AppContext.BaseDirectory;
            string candidate = Path.Combine(baseDir, "app");
            if (Directory.Exists(candidate))
                return candidate;

            // Walk up directories when running from bin/Debug or bin/Release
            DirectoryInfo? dir = new DirectoryInfo(baseDir);
            while (dir != null)
            {
                string check = Path.Combine(dir.FullName, "app");
                if (Directory.Exists(check))
                    return check;
                dir = dir.Parent;
            }

            return baseDir;
        }
    }

    [ComVisible(true)]
    public class NativeFileSaver
    {
        public string SaveTextFile(string filename, string content)
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                "FunctionalEarTrainer");
            Directory.CreateDirectory(dir);

            // Prevent path traversal by using only the file name component.
            string safeName = Path.GetFileName(filename);
            string path = Path.Combine(dir, safeName);
            File.WriteAllText(path, content, System.Text.Encoding.UTF8);
            return path;
        }
    }
}
