
import java.sql.Connection;
import java.sql.DriverManager;
import com.sybase.jdbc4.jdbc.SybDriver;
import java.sql.ResultSet;
import java.sql.Statement;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Properties;
import java.util.TimeZone;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.logging.Level;
import java.util.logging.Logger;
import net.minidev.json.JSONArray;
import net.minidev.json.JSONObject;

/**
 *
 * @author rod
 */
public class SybaseDB {

    public static final int TYPE_TIME_STAMP = 93;
    public static final int TYPE_DATE = 91;

    public static final int NUMBER_OF_THREADS = 5;

    String host;
    Integer port;
    String dbname;
    String username;
    String password;
    Properties props;
    Connection conn;
    DateFormat df = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.S'Z'");
    ExecutorService executor = Executors.newFixedThreadPool(NUMBER_OF_THREADS);

    public SybaseDB(String host, Integer port, String dbname, String username, String password) {
        this(host, port, dbname, username, password, new Properties());
    }

    public SybaseDB(String host, Integer port, String dbname, String username, String password, Properties props) {
        this.host = host;
        this.port = port;
        this.dbname = dbname;
        this.username = username;
        this.password = password;
        this.props = props;
        this.props.put("user", username);
        this.props.put("password", password);
        df.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    public boolean connect() {
        try {
            SybDriver sybDriver = (SybDriver) Class.forName("com.sybase.jdbc4.jdbc.SybDriver").newInstance();
            conn = DriverManager.getConnection("jdbc:sybase:Tds:" + host + ":" + port + "/" + dbname, props);
            return true;

        } catch (Exception ex) {
            System.err.println(ex);
            System.err.println(ex.getMessage());
            return false;
        }
    }

    public void execSQL(SQLRequest request) {
        ExecSQLCallable execSQLCallable = new ExecSQLCallable(conn, df, request);
        Future f = executor.submit(execSQLCallable);
        try {
            long timeout = request.timeout != 0 ? request.timeout : 600000l;
            f.get(timeout, TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            f.cancel(true);
            execSQLCallable.canceled = true;
            JSONObject response = new JSONObject();
            response.put("msgId", request.msgId);
            response.put("error", "Timeout" );
            System.out.println(response.toJSONString());
        } catch (ExecutionException ex) {
            f.cancel(true);
            execSQLCallable.canceled = true;
            JSONObject response = new JSONObject();
            response.put("msgId", request.msgId);
            response.put("error", "Timeout" );
            System.out.println(response.toJSONString());
        } catch (TimeoutException ex) {
            f.cancel(true);
            execSQLCallable.canceled = true;
            JSONObject response = new JSONObject();
            response.put("msgId", request.msgId);
            response.put("error", "Timeout" );
            System.out.println(response.toJSONString());
        }
    }

}
